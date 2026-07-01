import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { finished } from "node:stream/promises";
import path from "node:path";
import { BackendError } from "./errors.js";
import { DEFAULT_BUILDER_DATA_DIR, assertNewBuilderArtifactPath, assertSafeBuilderArtifactFilename } from "./builderArtifacts.js";
import { normalizeText } from "./utils.js";

const ABN_LOOKUP_JSON_BASE_URL = "https://abr.business.gov.au/json";

export function createAbnLookupClient(options = {}) {
  const guid = String(options.guid ?? "").trim();
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const baseUrl = options.baseUrl ?? ABN_LOOKUP_JSON_BASE_URL;

  async function matchingNames(name, lookupOptions = {}) {
    assertConfigured({ guid, fetchImpl });
    const trimmed = String(name ?? "").trim();
    if (!trimmed) throw new BackendError("validation.required", "name is required for ABN Lookup name search");
    const url = buildUrl(baseUrl, "MatchingNames.aspx", {
      name: trimmed,
      maxResults: String(lookupOptions.maxResults ?? 10),
      callback: "callback",
      guid,
    });
    return normalizeMatchingNamesResponse(await fetchJsonp(url, fetchImpl));
  }

  async function abnDetails(abn) {
    assertConfigured({ guid, fetchImpl });
    const normalizedAbn = normalizeBusinessNumber(abn);
    if (!normalizedAbn) throw new BackendError("validation.required", "abn is required for ABN Lookup ABN details");
    const url = buildUrl(baseUrl, "AbnDetails.aspx", {
      abn: normalizedAbn,
      callback: "callback",
      guid,
    });
    return normalizeDetailsResponse(await fetchJsonp(url, fetchImpl));
  }

  async function acnDetails(acn) {
    assertConfigured({ guid, fetchImpl });
    const normalizedAcn = normalizeBusinessNumber(acn);
    if (!normalizedAcn) throw new BackendError("validation.required", "acn is required for ABN Lookup ACN details");
    const url = buildUrl(baseUrl, "AcnDetails.aspx", {
      acn: normalizedAcn,
      callback: "callback",
      guid,
    });
    return normalizeDetailsResponse(await fetchJsonp(url, fetchImpl));
  }

  return {
    matchingNames,
    abnDetails,
    acnDetails,
  };
}

export function buildAbnLookupPlanFromJob(job, options = {}) {
  if (!job?.suggestedJobs?.includes("abn_lookup_identity_match")) {
    return {
      eligible: false,
      reason: "Enrichment job does not request ABN Lookup identity matching.",
    };
  }
  const queryName = cleanAbnSearchName(job.name);
  if (!queryName) {
    return {
      eligible: false,
      reason: "Builder job has no name to search.",
    };
  }

  return {
    eligible: true,
    builderId: job.builderId,
    jobId: job.jobId,
    queryName,
    maxResults: options.maxResults ?? 10,
    constraints: [
      "Use ABN Lookup response data only; do not infer missing business identity values.",
      "Treat name search candidates as review evidence unless match confidence is exact.",
    ],
  };
}

export async function runAbnLookupForJob(job, options = {}) {
  const plan = buildAbnLookupPlanFromJob(job, { maxResults: options.maxResults });
  if (!plan.eligible) {
    return {
      schemaVersion: 1,
      status: "skipped",
      builderId: job?.builderId ?? null,
      jobId: job?.jobId ?? null,
      reason: plan.reason,
    };
  }
  const client = options.client ?? createAbnLookupClient({
    guid: options.guid,
    fetchImpl: options.fetchImpl,
    baseUrl: options.baseUrl,
  });
  const checkedAt = options.checkedAt ?? new Date().toISOString();
  const response = await client.matchingNames(plan.queryName, { maxResults: plan.maxResults });
  const candidates = response.names.map((candidate) => scoreAbnCandidate(job, candidate));

  return {
    schemaVersion: 1,
    status: "checked",
    checkedAt,
    source: "ABN_LOOKUP_JSON",
    sourceUrl: "https://abr.business.gov.au/json/",
    builderId: job.builderId,
    jobId: job.jobId,
    queryName: plan.queryName,
    responseMessage: response.message,
    candidates,
    exactMatches: candidates.filter((candidate) => candidate.matchConfidence === "exact_name"),
    limitations: [
      "ABN Lookup name results are identity evidence candidates, not automatic builder-record updates.",
      "Persist ABN/ACN values to builder records only after a verified evidence merge step.",
    ],
  };
}

export function buildAbnMergeProposalFromResult(result, options = {}) {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const exactMatches = Array.isArray(result?.exactMatches) ? result.exactMatches : [];
  const base = {
    schemaVersion: 1,
    generatedAt,
    source: "ABN_LOOKUP_JSON",
    sourceUrl: result?.sourceUrl ?? "https://abr.business.gov.au/json/",
    builderId: result?.builderId ?? null,
    jobId: result?.jobId ?? null,
    queryName: result?.queryName ?? null,
    checkedAt: result?.checkedAt ?? null,
    reviewOnly: true,
    autoApply: false,
    limitations: [
      "This proposal is review-only and must not be automatically applied to builder records.",
      "ABN Lookup name-search results are evidence candidates; reviewer approval is required before persisting business identity fields.",
    ],
  };

  if (result?.status !== "checked") {
    return {
      ...base,
      proposalStatus: "not_proposed",
      reason: "ABN Lookup result was not checked.",
      proposedUpdates: {},
      evidence: { candidateCount: 0, exactMatchCount: 0 },
    };
  }

  if (exactMatches.length !== 1) {
    return {
      ...base,
      proposalStatus: "manual_review",
      reason: exactMatches.length === 0 ? "No exact ABN Lookup name match was found." : "Multiple exact ABN Lookup name matches were found.",
      proposedUpdates: {},
      evidence: {
        candidateCount: result.candidates?.length ?? 0,
        exactMatchCount: exactMatches.length,
        candidates: result.candidates ?? [],
      },
    };
  }

  const match = exactMatches[0];
  const proposedUpdates = {};
  if (match.abn) proposedUpdates.abn = normalizeBusinessNumber(match.abn);
  if (match.acn) proposedUpdates.acn = normalizeBusinessNumber(match.acn);

  if (!proposedUpdates.abn && !proposedUpdates.acn) {
    return {
      ...base,
      proposalStatus: "manual_review",
      reason: "Exact ABN Lookup name match did not include ABN or ACN.",
      proposedUpdates: {},
      evidence: {
        candidateCount: result.candidates?.length ?? 0,
        exactMatchCount: exactMatches.length,
        candidate: match,
      },
    };
  }

  return {
    ...base,
    proposalId: `builder-abn-proposal:${result.builderId}:${proposedUpdates.abn ?? proposedUpdates.acn}`,
    proposalStatus: "proposed",
    confidence: "exact_name",
    proposedUpdates,
    evidence: {
      source: "ABN_LOOKUP_JSON",
      sourceUrl: result.sourceUrl ?? "https://abr.business.gov.au/json/",
      queryName: result.queryName,
      responseMessage: result.responseMessage,
      candidateCount: result.candidates?.length ?? 0,
      exactMatchCount: exactMatches.length,
      candidate: match,
    },
    constraints: [
      "Apply only after a reviewer confirms the ABN Lookup evidence belongs to this imported builder record.",
      "Retain this proposal artifact or equivalent source evidence with any persisted builder update.",
    ],
  };
}

export async function writeAbnMergeProposals(options = {}) {
  const dataDir = options.dataDir ?? DEFAULT_BUILDER_DATA_DIR;
  const outputDir = options.outputDir ?? dataDir;
  const inputFilename = assertSafeBuilderArtifactFilename(options.inputFilename ?? "builder-abn-lookup-results.ndjson", "ABN lookup input filename");
  const outputFilename = assertSafeBuilderArtifactFilename(options.outputFilename ?? "builder-abn-merge-proposals.ndjson", "ABN merge output filename");
  const summaryFilename = assertSafeBuilderArtifactFilename(options.summaryFilename ?? "builder-abn-merge-summary.json", "ABN merge summary filename");
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const inputPath = path.join(dataDir, inputFilename);
  const outputPath = path.join(outputDir, outputFilename);
  const summaryPath = path.join(outputDir, summaryFilename);

  await mkdir(outputDir, { recursive: true });
  await assertNewBuilderArtifactPath(outputPath, outputFilename, { overwrite: options.overwrite });
  await assertNewBuilderArtifactPath(summaryPath, summaryFilename, { overwrite: options.overwrite });

  try {
    await access(inputPath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new BackendError("validation.required", `ABN lookup results file is required: ${inputFilename}`);
    }
    throw error;
  }

  const output = createWriteStream(outputPath, { encoding: "utf8" });
  const hash = createHash("sha256");
  let scannedResults = 0;
  let proposedRows = 0;
  let manualReviewRows = 0;
  let notProposedRows = 0;

  try {
    for await (const result of readNdjson(inputPath)) {
      scannedResults += 1;
      const proposal = buildAbnMergeProposalFromResult(result, { generatedAt });
      if (proposal.proposalStatus === "proposed") proposedRows += 1;
      else if (proposal.proposalStatus === "manual_review") manualReviewRows += 1;
      else notProposedRows += 1;

      const line = `${JSON.stringify(proposal)}\n`;
      hash.update(line);
      if (!output.write(line)) {
        await new Promise((resolve) => output.once("drain", resolve));
      }
    }
  } finally {
    output.end();
    await finished(output);
  }

  const summary = {
    schemaVersion: 1,
    generatedAt,
    source: "ABN_LOOKUP_JSON",
    inputFile: inputFilename,
    outputFile: outputFilename,
    totals: {
      scannedResults,
      proposalRows: scannedResults,
      proposedRows,
      manualReviewRows,
      notProposedRows,
    },
    files: {
      [outputFilename]: {
        format: "ndjson",
        rowCount: scannedResults,
        sha256: hash.digest("hex"),
      },
    },
    limitations: [
      "ABN merge proposals are review-only and are not automatically applied to builder records.",
      "Only exact single-name matches receive proposed ABN/ACN updates; zero or multiple exact matches remain manual review.",
    ],
  };

  await writeJsonFile(summaryPath, summary);
  return { outputPath, summaryPath, summary };
}

export function normalizeBusinessNumber(value) {
  const normalized = String(value ?? "").replace(/[^\d]/g, "");
  return normalized || undefined;
}

function scoreAbnCandidate(job, candidate) {
  const queryName = normalizeNameForMatch(job.name);
  const candidateName = normalizeNameForMatch(candidate.name);
  const matchConfidence = candidateName && candidateName === queryName ? "exact_name" : "review_required";

  return {
    abn: candidate.abn,
    acn: candidate.acn,
    name: candidate.name,
    state: candidate.state,
    postcode: candidate.postcode,
    abnStatus: candidate.abnStatus,
    isCurrent: candidate.isCurrent,
    score: matchConfidence === "exact_name" ? 100 : 30,
    matchConfidence,
    evidence: candidate.raw,
  };
}

function normalizeMatchingNamesResponse(value) {
  const names = asArray(value.Names ?? value.names ?? value.AbnMatches ?? value.abnMatches).map((item) => ({
    abn: normalizeBusinessNumber(item.Abn ?? item.abn),
    acn: normalizeBusinessNumber(item.Acn ?? item.acn),
    name: cleanString(item.Name ?? item.name ?? item.EntityName ?? item.entityName ?? item.BusinessName ?? item.businessName),
    state: cleanString(item.State ?? item.state),
    postcode: cleanString(item.Postcode ?? item.postcode),
    abnStatus: cleanString(item.AbnStatus ?? item.abnStatus),
    isCurrent: Boolean(item.IsCurrent ?? item.isCurrent ?? item.AbnStatus === "Active"),
    raw: item,
  }));

  return {
    message: cleanString(value.Message ?? value.message),
    names,
    raw: value,
  };
}

function normalizeDetailsResponse(value) {
  return {
    abn: normalizeBusinessNumber(value.Abn ?? value.abn),
    acn: normalizeBusinessNumber(value.Acn ?? value.acn),
    entityName: cleanString(value.EntityName ?? value.entityName),
    businessName: asArray(value.BusinessName ?? value.businessName).map(cleanString).filter(Boolean),
    entityTypeName: cleanString(value.EntityTypeName ?? value.entityTypeName),
    abnStatus: cleanString(value.AbnStatus ?? value.abnStatus),
    gst: cleanString(value.Gst ?? value.gst),
    addressState: cleanString(value.AddressState ?? value.addressState),
    addressPostcode: cleanString(value.AddressPostcode ?? value.addressPostcode),
    message: cleanString(value.Message ?? value.message),
    raw: value,
  };
}

async function fetchJsonp(url, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: { "user-agent": "DwellaABNLookup/0.1" },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new BackendError("abn_lookup.http_error", `ABN Lookup request failed: ${response.status} ${response.statusText}`, {
      status: response.status,
      statusText: response.statusText,
    });
  }
  return parseJsonp(await response.text());
}

function parseJsonp(text) {
  const trimmed = String(text ?? "").trim();
  const match = trimmed.match(/^[\w$.]+\(([\s\S]*)\);?$/);
  const json = match ? match[1] : trimmed;
  try {
    return JSON.parse(json);
  } catch (error) {
    throw new BackendError("abn_lookup.invalid_json", "ABN Lookup returned invalid JSON/JSONP", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function assertConfigured({ guid, fetchImpl }) {
  if (!guid) throw new BackendError("integration.missing", "ABN Lookup requires ABN_LOOKUP_GUID");
  if (typeof fetchImpl !== "function") throw new BackendError("integration.missing", "ABN Lookup requires fetch");
}

function buildUrl(baseUrl, endpoint, params) {
  const url = new URL(`${String(baseUrl).replace(/\/$/, "")}/${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, value);
  }
  return url;
}

function normalizeNameForMatch(value) {
  return normalizeText(value)
    .replace(/\b(pty|ltd|limited|proprietary|the|australia|australian)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanAbnSearchName(value) {
  return String(value ?? "")
    .replace(/^[^a-z0-9]+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanString(value) {
  const cleaned = String(value ?? "").trim();
  return cleaned || undefined;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

async function* readNdjson(filepath) {
  const rl = createInterface({ input: createReadStream(filepath) });
  for await (const line of rl) {
    if (line.trim()) yield JSON.parse(line);
  }
}

async function writeJsonFile(filepath, value) {
  const output = createWriteStream(filepath, { encoding: "utf8" });
  output.end(`${JSON.stringify(value, null, 2)}\n`);
  await finished(output);
}
