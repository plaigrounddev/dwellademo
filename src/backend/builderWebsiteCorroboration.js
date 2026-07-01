import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { finished } from "node:stream/promises";
import path from "node:path";
import { DEFAULT_BUILDER_DATA_DIR, assertNewBuilderArtifactPath, assertSafeBuilderArtifactFilename } from "./builderArtifacts.js";
import { BackendError } from "./errors.js";
import { normalizeState, normalizeText } from "./utils.js";

const MAX_HTML_BYTES = 1_000_000;

export function buildWebsiteCorroborationPlan(candidate) {
  if (!candidate?.reviewOnly || candidate?.autoApply !== false) {
    return {
      eligible: false,
      reason: "Website candidate must be reviewOnly with autoApply false.",
    };
  }
  if (candidate.candidateStatus !== "candidate") {
    return {
      eligible: false,
      reason: "Website candidate is not candidate status.",
    };
  }
  const url = cleanUrl(candidate.url);
  if (!url) {
    return {
      eligible: false,
      reason: "Website candidate has no valid URL.",
    };
  }
  return {
    eligible: true,
    candidateId: candidate.candidateId,
    builderId: candidate.builderId,
    discoveryJobId: candidate.discoveryJobId,
    builderName: candidate.builderName,
    states: (candidate.states ?? []).map(normalizeState).filter(Boolean),
    licenceNumbers: (candidate.licenceNumbers ?? []).filter(Boolean),
    licenceClasses: (candidate.licenceClasses ?? []).filter(Boolean),
    url,
    host: candidate.host ?? getHost(url),
    provider: candidate.provider ?? "unknown",
    searchRank: candidate.rank ?? null,
    constraints: [
      "Fetch candidate website content before proposing a builder website URL.",
      "Corroboration is review evidence only and must not auto-apply builder.websiteUrl.",
      "Require builder identity signals from fetched page content, not only search-result snippets.",
    ],
  };
}

export async function fetchWebsiteCorroboration(candidate, options = {}) {
  const plan = buildWebsiteCorroborationPlan(candidate);
  if (!plan.eligible) {
    return {
      schemaVersion: 1,
      status: "skipped",
      candidateId: candidate?.candidateId ?? null,
      builderId: candidate?.builderId ?? null,
      reason: plan.reason,
    };
  }
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (!fetchImpl) throw new BackendError("integration.website_fetch_missing", "Fetch is required for website corroboration");
  const fetchedAt = options.fetchedAt ?? new Date().toISOString();
  const response = await fetchImpl(plan.url, {
    redirect: "follow",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": options.userAgent ?? "DwellaBuilderEvidenceBot/1.0",
    },
  });
  const contentType = response.headers?.get?.("content-type") ?? "";
  if (!response.ok) {
    return buildCorroborationResult(plan, {
      fetchedAt,
      fetchStatus: "fetch_failed",
      httpStatus: response.status,
      contentType,
      pageText: "",
    });
  }
  if (contentType && !contentType.toLowerCase().includes("text/html")) {
    return buildCorroborationResult(plan, {
      fetchedAt,
      fetchStatus: "unsupported_content_type",
      httpStatus: response.status,
      contentType,
      pageText: "",
    });
  }
  const html = await response.text();
  const pageText = extractPageText(html).slice(0, MAX_HTML_BYTES);
  return buildCorroborationResult(plan, {
    fetchedAt,
    fetchStatus: "fetched",
    httpStatus: response.status,
    contentType,
    pageText,
  });
}

export async function writeWebsiteCorroborationEvidence(options = {}) {
  const dataDir = options.dataDir ?? DEFAULT_BUILDER_DATA_DIR;
  const outputDir = options.outputDir ?? dataDir;
  const inputFilename = assertSafeBuilderArtifactFilename(
    options.inputFilename ?? "builder-website-candidates.ndjson",
    "website corroboration input filename"
  );
  const outputFilename = assertSafeBuilderArtifactFilename(
    options.outputFilename ?? "builder-website-corroboration.ndjson",
    "website corroboration output filename"
  );
  const summaryFilename = assertSafeBuilderArtifactFilename(
    options.summaryFilename ?? "builder-website-corroboration-summary.json",
    "website corroboration summary filename"
  );
  const fetchedAt = options.fetchedAt ?? new Date().toISOString();
  const state = normalizeState(options.state);
  const requestedLimit = Number(options.limit ?? 10);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.floor(requestedLimit)) : 10;
  const inputPath = path.join(dataDir, inputFilename);
  const outputPath = path.join(outputDir, outputFilename);
  const summaryPath = path.join(outputDir, summaryFilename);
  const hash = createHash("sha256");
  const byStatus = {};
  const byState = {};
  let scannedCandidates = 0;
  let eligibleCandidates = 0;
  let fetchedCandidates = 0;
  let corroboratedCandidates = 0;

  await mkdir(outputDir, { recursive: true });
  await assertNewBuilderArtifactPath(outputPath, outputFilename, { overwrite: options.overwrite });
  await assertNewBuilderArtifactPath(summaryPath, summaryFilename, { overwrite: options.overwrite });
  const output = createWriteStream(outputPath, { encoding: "utf8" });

  try {
    for await (const candidate of readNdjson(inputPath)) {
      scannedCandidates += 1;
      if (state && !candidate.states?.includes(state)) continue;
      const plan = buildWebsiteCorroborationPlan(candidate);
      if (!plan.eligible) continue;
      eligibleCandidates += 1;
      if (fetchedCandidates >= limit) break;
      const result = await fetchWebsiteCorroboration(candidate, {
        fetchImpl: options.fetchImpl,
        fetchedAt,
        userAgent: options.userAgent,
      });
      fetchedCandidates += 1;
      if (result.corroborationStatus === "corroborated") corroboratedCandidates += 1;
      byStatus[result.corroborationStatus] = (byStatus[result.corroborationStatus] ?? 0) + 1;
      for (const itemState of result.states ?? []) byState[itemState] = (byState[itemState] ?? 0) + 1;
      const line = `${JSON.stringify(result)}\n`;
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
    fetchedAt,
    inputFile: inputFilename,
    outputFile: outputFilename,
    filters: {
      state: state ?? null,
      limit,
    },
    totals: {
      scannedCandidates,
      eligibleCandidates,
      fetchedCandidates,
      corroboratedCandidates,
    },
    byStatus,
    byState,
    files: {
      [outputFilename]: {
        format: "ndjson",
        rowCount: fetchedCandidates,
        sha256: hash.digest("hex"),
      },
    },
    limitations: [
      "Corroboration rows are fetched-page evidence only; they do not update builder records.",
      "A human or stricter review workflow must approve any builder website URL promotion.",
      "Name and licence signals can be absent from legitimate websites, so non-corroborated rows remain review evidence.",
    ],
  };
  await writeJsonFile(summaryPath, summary);
  return { outputPath, summaryPath, summary };
}

export function buildWebsiteUpdateProposalFromCorroboration(row, options = {}) {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const base = {
    schemaVersion: 1,
    generatedAt,
    source: "WEBSITE_CORROBORATION",
    corroborationId: row?.corroborationId ?? null,
    candidateId: row?.candidateId ?? null,
    builderId: row?.builderId ?? null,
    discoveryJobId: row?.discoveryJobId ?? null,
    builderName: row?.builderName ?? null,
    url: row?.url ?? null,
    host: row?.host ?? null,
    reviewOnly: true,
    autoApply: false,
    proposedUpdates: {},
    evidence: {
      corroborationStatus: row?.corroborationStatus ?? null,
      fetchStatus: row?.fetchStatus ?? null,
      httpStatus: row?.httpStatus ?? null,
      score: row?.score ?? 0,
      matchedNameTerms: row?.matchedNameTerms ?? [],
      matchedLicenceNumbers: row?.matchedLicenceNumbers ?? [],
      matchedStates: row?.matchedStates ?? [],
      pageTextHash: row?.pageTextHash ?? null,
    },
    limitations: [
      "This proposal is review-only and must not be automatically applied to builder records.",
      "A reviewer must approve the corroborated website evidence before persisting builder.websiteUrl.",
    ],
  };

  if (row?.corroborationStatus !== "corroborated") {
    return {
      ...base,
      proposalStatus: "manual_review",
      reason: "Website corroboration did not meet automatic proposal confidence.",
    };
  }

  const url = cleanUrl(row.url);
  if (!url) {
    return {
      ...base,
      proposalStatus: "not_proposed",
      reason: "Corroborated row does not contain a valid URL.",
    };
  }

  return {
    ...base,
    proposalId: `builder-website-proposal:${stableHash([row.builderId, url])}`,
    proposalStatus: "proposed",
    confidence: "fetched_page_identity_corroborated",
    proposedUpdates: {
      websiteUrl: url,
    },
    evidence: {
      ...base.evidence,
      source: "WEBSITE_CORROBORATION",
      fetchedAt: row.fetchedAt ?? null,
      contentType: row.contentType ?? null,
      provider: row.provider ?? null,
      searchRank: row.searchRank ?? null,
    },
    constraints: [
      "Apply only after a reviewer confirms the fetched-page evidence belongs to this imported builder record.",
      "Retain this proposal artifact or equivalent source evidence with any persisted builder website update.",
    ],
  };
}

export async function writeWebsiteUpdateProposals(options = {}) {
  const dataDir = options.dataDir ?? DEFAULT_BUILDER_DATA_DIR;
  const outputDir = options.outputDir ?? dataDir;
  const inputFilename = assertSafeBuilderArtifactFilename(
    options.inputFilename ?? "builder-website-corroboration.ndjson",
    "website update proposal input filename"
  );
  const outputFilename = assertSafeBuilderArtifactFilename(
    options.outputFilename ?? "builder-website-update-proposals.ndjson",
    "website update proposal output filename"
  );
  const summaryFilename = assertSafeBuilderArtifactFilename(
    options.summaryFilename ?? "builder-website-update-proposals-summary.json",
    "website update proposal summary filename"
  );
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const inputPath = path.join(dataDir, inputFilename);
  const outputPath = path.join(outputDir, outputFilename);
  const summaryPath = path.join(outputDir, summaryFilename);
  const hash = createHash("sha256");
  let scannedCorroborations = 0;
  let proposedRows = 0;
  let manualReviewRows = 0;
  let notProposedRows = 0;

  await mkdir(outputDir, { recursive: true });
  await assertNewBuilderArtifactPath(outputPath, outputFilename, { overwrite: options.overwrite });
  await assertNewBuilderArtifactPath(summaryPath, summaryFilename, { overwrite: options.overwrite });
  const output = createWriteStream(outputPath, { encoding: "utf8" });

  try {
    for await (const row of readNdjson(inputPath)) {
      scannedCorroborations += 1;
      const proposal = buildWebsiteUpdateProposalFromCorroboration(row, { generatedAt });
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
    source: "WEBSITE_CORROBORATION",
    inputFile: inputFilename,
    outputFile: outputFilename,
    totals: {
      scannedCorroborations,
      proposalRows: scannedCorroborations,
      proposedRows,
      manualReviewRows,
      notProposedRows,
    },
    files: {
      [outputFilename]: {
        format: "ndjson",
        rowCount: scannedCorroborations,
        sha256: hash.digest("hex"),
      },
    },
    limitations: [
      "Website update proposals are review-only and are not automatically applied to builder records.",
      "Only fetched-page corroborated rows receive proposed websiteUrl updates; other rows remain manual review.",
    ],
  };

  await writeJsonFile(summaryPath, summary);
  return { outputPath, summaryPath, summary };
}

function buildCorroborationResult(plan, evidence) {
  const normalizedText = normalizeText(evidence.pageText);
  const nameTerms = tokenize(plan.builderName).filter((term) => term.length > 2);
  const matchedNameTerms = nameTerms.filter((term) => normalizedText.includes(term));
  const matchedLicenceNumbers = plan.licenceNumbers.filter((licenceNumber) => normalizedText.includes(normalizeText(licenceNumber)));
  const matchedStates = plan.states.filter((state) => normalizedText.includes(normalizeText(state)) || normalizedText.includes(stateName(state)));
  const score = Math.min(100, matchedNameTerms.length * 25 + matchedLicenceNumbers.length * 35 + matchedStates.length * 10);
  const corroborated = evidence.fetchStatus === "fetched" && matchedNameTerms.length >= Math.min(2, nameTerms.length) && score >= 50;
  return {
    schemaVersion: 1,
    corroborationId: `builder-website-corroboration:${stableHash([plan.candidateId, plan.url, evidence.fetchedAt])}`,
    fetchedAt: evidence.fetchedAt,
    candidateId: plan.candidateId,
    builderId: plan.builderId,
    discoveryJobId: plan.discoveryJobId,
    builderName: plan.builderName,
    states: plan.states,
    licenceNumbers: plan.licenceNumbers,
    licenceClasses: plan.licenceClasses,
    url: plan.url,
    host: plan.host,
    provider: plan.provider,
    searchRank: plan.searchRank,
    fetchStatus: evidence.fetchStatus,
    httpStatus: evidence.httpStatus ?? null,
    contentType: evidence.contentType || null,
    corroborationStatus: corroborated ? "corroborated" : "review_required",
    reviewOnly: true,
    autoApply: false,
    score,
    matchedNameTerms,
    matchedLicenceNumbers,
    matchedStates,
    pageTextHash: stableHash(evidence.pageText ?? ""),
    pageTextSample: evidence.pageText ? evidence.pageText.slice(0, 500) : null,
    constraints: plan.constraints,
  };
}

export function extractPageText(html) {
  return String(html ?? "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function stableHash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 20);
}

function tokenize(value) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/i)
    .map((term) => term.trim())
    .filter(Boolean);
}

function stateName(state) {
  const names = {
    ACT: "australian capital territory",
    NSW: "new south wales",
    NT: "northern territory",
    QLD: "queensland",
    SA: "south australia",
    TAS: "tasmania",
    VIC: "victoria",
    WA: "western australia",
  };
  return names[state] ?? normalizeText(state);
}

function cleanUrl(value) {
  const text = String(value ?? "").trim();
  if (!text) return undefined;
  try {
    return new URL(text).href;
  } catch {
    return undefined;
  }
}

function getHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return undefined;
  }
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
