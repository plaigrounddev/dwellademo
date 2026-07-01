import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { createInterface } from "node:readline/promises";
import { finished } from "node:stream/promises";
import path from "node:path";
import { DEFAULT_BUILDER_DATA_DIR, assertSafeBuilderArtifactFilename } from "./builderArtifacts.js";
import { normalizeState } from "./utils.js";

const KNOWN_GAPS = new Set([
  "business_identity",
  "website_discovery",
  "website_enrichment",
  "service_region",
  "address",
]);

export async function getBuilderEnrichmentPlan(options = {}) {
  const dataDir = options.dataDir ?? DEFAULT_BUILDER_DATA_DIR;
  const requestedLimit = Number(options.limit ?? 50);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(Math.floor(requestedLimit), 500)) : 50;
  const state = normalizeState(options.state);
  const requestedGap = normalizeGap(options.gap);
  const [manifest, qualityReport, licenceSummary] = await Promise.all([
    readJson(path.join(dataDir, "manifest.json")),
    readOptionalJson(path.join(dataDir, "quality-report.json")),
    readLicenceSummary(path.join(dataDir, "builder-licences.ndjson")),
  ]);
  const gapCounts = emptyGapCounts();
  const gapCountsByState = {};
  const priorityBuilders = [];
  let scannedBuilders = 0;
  let matchingBuilders = 0;

  for await (const builder of readNdjson(path.join(dataDir, "builders.ndjson"))) {
    scannedBuilders += 1;
    if (state && !builder.states?.includes(state)) continue;
    const gaps = detectBuilderEnrichmentGaps(builder);
    if (requestedGap && !gaps.includes(requestedGap)) continue;
    matchingBuilders += 1;
    countGaps(gapCounts, gapCountsByState, builder.states ?? [], gaps);
    if (!gaps.length) continue;

    const licence = licenceSummary.get(builder.id) ?? { count: 0, licenceClasses: [], licenceNumbers: [] };
    const candidate = buildPriorityCandidate(builder, gaps, licence);
    insertTopCandidate(priorityBuilders, candidate, limit);
  }

  return {
    generatedAt: new Date().toISOString(),
    sourceManifestGeneratedAt: manifest.generatedAt,
    filters: {
      state: state ?? null,
      gap: requestedGap ?? null,
      limit,
    },
    totals: {
      scannedBuilders,
      matchingBuilders,
      importedBuilders: manifest.totals?.builders ?? scannedBuilders,
      importedLicences: manifest.totals?.licences ?? 0,
    },
    baselineCoverage: {
      builderFieldCoverage: qualityReport?.builderFieldCoverage ?? null,
      memoryCardCoverage: qualityReport?.memoryCardCoverage ?? null,
    },
    gapCounts,
    gapCountsByState,
    priorityBuilders: priorityBuilders.sort(compareCandidates),
    limitations: [
      "This plan identifies enrichment gaps in imported official licence evidence; it does not create or infer missing ABNs, websites or service regions.",
      "Run enrichment jobs only with production-safe integrations such as ABN Lookup credentials, sanctioned directory access, or fetched builder websites.",
      "Priority scores are operational triage signals, not suitability rankings for homeowners.",
    ],
  };
}

export async function writeBuilderEnrichmentJobs(options = {}) {
  const dataDir = options.dataDir ?? DEFAULT_BUILDER_DATA_DIR;
  const outputDir = options.outputDir ?? dataDir;
  const outputFilename = assertSafeBuilderArtifactFilename(options.outputFilename ?? "builder-enrichment-jobs.ndjson", "builder enrichment output filename");
  const summaryFilename = assertSafeBuilderArtifactFilename(options.summaryFilename ?? "builder-enrichment-summary.json", "builder enrichment summary filename");
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const state = normalizeState(options.state);
  const requestedGap = normalizeGap(options.gap);
  const [manifest, qualityReport, licenceSummary] = await Promise.all([
    readJson(path.join(dataDir, "manifest.json")),
    readOptionalJson(path.join(dataDir, "quality-report.json")),
    readLicenceSummary(path.join(dataDir, "builder-licences.ndjson")),
  ]);
  const outputPath = path.join(outputDir, outputFilename);
  const summaryPath = path.join(outputDir, summaryFilename);
  const output = createWriteStream(outputPath, { encoding: "utf8" });
  const hash = createHash("sha256");
  const gapCounts = emptyGapCounts();
  const gapCountsByState = {};
  const suggestedJobCounts = {};
  let scannedBuilders = 0;
  let matchingBuilders = 0;
  let jobRows = 0;

  try {
    for await (const builder of readNdjson(path.join(dataDir, "builders.ndjson"))) {
      scannedBuilders += 1;
      if (state && !builder.states?.includes(state)) continue;
      const gaps = detectBuilderEnrichmentGaps(builder);
      if (requestedGap && !gaps.includes(requestedGap)) continue;
      matchingBuilders += 1;
      countGaps(gapCounts, gapCountsByState, builder.states ?? [], gaps);
      if (!gaps.length) continue;

      const licence = licenceSummary.get(builder.id) ?? { count: 0, licenceClasses: [], licenceNumbers: [] };
      const job = buildEnrichmentJob(builder, gaps, licence, {
        generatedAt,
        sourceManifestGeneratedAt: manifest.generatedAt,
      });
      for (const suggestedJob of job.suggestedJobs) {
        suggestedJobCounts[suggestedJob] = (suggestedJobCounts[suggestedJob] ?? 0) + 1;
      }
      const line = `${JSON.stringify(job)}\n`;
      hash.update(line);
      if (!output.write(line)) {
        await new Promise((resolve) => output.once("drain", resolve));
      }
      jobRows += 1;
    }
  } finally {
    output.end();
    await finished(output);
  }

  const summary = {
    schemaVersion: 1,
    generatedAt,
    sourceManifestGeneratedAt: manifest.generatedAt,
    filters: {
      state: state ?? null,
      gap: requestedGap ?? null,
    },
    totals: {
      scannedBuilders,
      matchingBuilders,
      jobRows,
      importedBuilders: manifest.totals?.builders ?? scannedBuilders,
      importedLicences: manifest.totals?.licences ?? 0,
    },
    gapCounts,
    gapCountsByState,
    suggestedJobCounts,
    baselineCoverage: {
      builderFieldCoverage: qualityReport?.builderFieldCoverage ?? null,
      memoryCardCoverage: qualityReport?.memoryCardCoverage ?? null,
    },
    files: {
      [outputFilename]: {
        format: "ndjson",
        rowCount: jobRows,
        sha256: hash.digest("hex"),
      },
    },
    limitations: [
      "This artifact queues enrichment work from imported official licence evidence; it does not create or infer missing ABNs, websites or service regions.",
      "Rows must be processed by production-safe integrations such as ABN Lookup credentials, sanctioned directory access, or fetched builder websites.",
      "Jobs are operational triage work items, not suitability rankings for homeowners.",
    ],
  };
  await writeJsonFile(summaryPath, summary);
  return {
    outputPath,
    summaryPath,
    summary,
  };
}

export function detectBuilderEnrichmentGaps(builder) {
  const gaps = [];
  if (!builder.abn && !builder.acn) gaps.push("business_identity");
  if (!builder.websiteUrl) gaps.push("website_discovery");
  if (builder.websiteUrl && !builder.evidenceQuality?.websiteEnriched) gaps.push("website_enrichment");
  if (!builder.serviceRegions?.length) gaps.push("service_region");
  if (!builder.addresses?.length) gaps.push("address");
  return gaps;
}

function buildPriorityCandidate(builder, gaps, licence) {
  const knownFields = {
    hasAbn: Boolean(builder.abn),
    hasAcn: Boolean(builder.acn),
    hasWebsite: Boolean(builder.websiteUrl),
    hasServiceRegions: Boolean(builder.serviceRegions?.length),
    hasAddress: Boolean(builder.addresses?.length),
    licenceCount: licence.count,
  };
  const score =
    gaps.length * 20 +
    (gaps.includes("business_identity") ? 25 : 0) +
    (gaps.includes("website_discovery") ? 20 : 0) +
    (!knownFields.hasServiceRegions ? 10 : 0) +
    Math.min(licence.count, 5) * 3;

  return {
    builderId: builder.id,
    name: builder.name,
    states: builder.states ?? [],
    sourceIds: builder.sourceIds ?? [],
    gaps,
    score,
    reasons: buildReasons(gaps, knownFields),
    knownFields,
    licenceClasses: licence.licenceClasses.slice(0, 5),
    licenceNumbers: licence.licenceNumbers.slice(0, 5),
    suggestedJobs: gaps.map(gapToJob),
  };
}

function buildEnrichmentJob(builder, gaps, licence, metadata) {
  const candidate = buildPriorityCandidate(builder, gaps, licence);
  return {
    schemaVersion: 1,
    jobId: `builder-enrichment:${builder.id}`,
    builderId: builder.id,
    name: builder.name,
    states: builder.states ?? [],
    sourceIds: builder.sourceIds ?? [],
    sourceManifestGeneratedAt: metadata.sourceManifestGeneratedAt,
    generatedAt: metadata.generatedAt,
    gaps: candidate.gaps,
    suggestedJobs: candidate.suggestedJobs,
    priorityScore: candidate.score,
    reasons: candidate.reasons,
    evidence: {
      licenceCount: licence.count,
      licenceClasses: licence.licenceClasses.slice(0, 10),
      licenceNumbers: licence.licenceNumbers.slice(0, 10),
      hasAbn: Boolean(builder.abn),
      hasAcn: Boolean(builder.acn),
      hasWebsite: Boolean(builder.websiteUrl),
      hasServiceRegions: Boolean(builder.serviceRegions?.length),
      hasAddress: Boolean(builder.addresses?.length),
      evidenceQuality: builder.evidenceQuality ?? {},
    },
    constraints: [
      "Do not infer missing ABN, ACN, website, service region or address values.",
      "Do not write enrichment results without a recorded source URL or integration response.",
    ],
  };
}

function buildReasons(gaps, knownFields) {
  const reasons = [];
  if (gaps.includes("business_identity")) reasons.push("No ABN or ACN is recorded in the imported licence evidence.");
  if (gaps.includes("website_discovery")) reasons.push("No website URL is recorded; website capability enrichment cannot run yet.");
  if (gaps.includes("website_enrichment")) reasons.push("Website URL exists but no evidence-backed website summary has been recorded.");
  if (gaps.includes("service_region")) reasons.push("No postcode or service-region signal is recorded.");
  if (gaps.includes("address")) reasons.push("No public address was imported from the licence source.");
  if (knownFields.licenceCount > 1) reasons.push(`${knownFields.licenceCount} licence records make this useful for identity dedupe review.`);
  return reasons;
}

function gapToJob(gap) {
  if (gap === "business_identity") return "abn_lookup_identity_match";
  if (gap === "website_discovery") return "official_website_discovery";
  if (gap === "website_enrichment") return "website_summary_refresh";
  if (gap === "service_region") return "service_region_extraction";
  if (gap === "address") return "address_normalisation";
  return "manual_review";
}

function countGaps(gapCounts, gapCountsByState, states, gaps) {
  for (const gap of gaps) {
    gapCounts[gap] += 1;
    for (const state of states) {
      gapCountsByState[state] ??= emptyGapCounts();
      gapCountsByState[state][gap] += 1;
    }
  }
}

async function readLicenceSummary(filepath) {
  const summary = new Map();
  for await (const licence of readNdjson(filepath)) {
    const builderId = licence.builderId;
    if (!builderId) continue;
    const existing = summary.get(builderId) ?? { count: 0, licenceClasses: [], licenceNumbers: [] };
    existing.count += 1;
    if (licence.licenceClass && !existing.licenceClasses.includes(licence.licenceClass)) existing.licenceClasses.push(licence.licenceClass);
    if (licence.licenceNumber && !existing.licenceNumbers.includes(licence.licenceNumber)) existing.licenceNumbers.push(licence.licenceNumber);
    summary.set(builderId, existing);
  }
  return summary;
}

function insertTopCandidate(candidates, candidate, limit) {
  candidates.push(candidate);
  candidates.sort(compareCandidates);
  if (candidates.length > limit) candidates.pop();
}

function compareCandidates(a, b) {
  return b.score - a.score || b.knownFields.licenceCount - a.knownFields.licenceCount || a.name.localeCompare(b.name);
}

function emptyGapCounts() {
  return {
    business_identity: 0,
    website_discovery: 0,
    website_enrichment: 0,
    service_region: 0,
    address: 0,
  };
}

function normalizeGap(value) {
  const gap = String(value ?? "").trim();
  if (!gap) return undefined;
  if (!KNOWN_GAPS.has(gap)) {
    throw new Error(`Unknown enrichment gap "${gap}". Expected one of: ${[...KNOWN_GAPS].join(", ")}`);
  }
  return gap;
}

async function readJson(filepath) {
  return JSON.parse(await readFile(filepath, "utf8"));
}

async function writeJsonFile(filepath, value) {
  const output = createWriteStream(filepath, { encoding: "utf8" });
  output.end(`${JSON.stringify(value, null, 2)}\n`);
  await finished(output);
}

async function readOptionalJson(filepath) {
  try {
    return await readJson(filepath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function* readNdjson(filepath) {
  const rl = createInterface({ input: createReadStream(filepath) });
  for await (const line of rl) {
    if (line.trim()) yield JSON.parse(line);
  }
}
