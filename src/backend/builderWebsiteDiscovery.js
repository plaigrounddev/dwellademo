import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { finished } from "node:stream/promises";
import path from "node:path";
import { DEFAULT_BUILDER_DATA_DIR, assertNewBuilderArtifactPath, assertSafeBuilderArtifactFilename } from "./builderArtifacts.js";
import { normalizeState, normalizeText } from "./utils.js";

const WEBSITE_DISCOVERY_JOB = "official_website_discovery";
const EXCLUDED_HOSTS = [
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "yellowpages.com.au",
  "hipages.com.au",
  "oneflare.com.au",
  "hia.com.au",
  "mbqld.com.au",
  "masterbuilders.com.au",
  "service.com.au",
];

export function buildWebsiteDiscoveryPlanFromJob(job, options = {}) {
  if (!job?.suggestedJobs?.includes(WEBSITE_DISCOVERY_JOB)) {
    return {
      eligible: false,
      reason: "Enrichment job does not request official website discovery.",
    };
  }
  const name = cleanBuilderSearchName(job.name);
  if (!name) {
    return {
      eligible: false,
      reason: "Builder job has no name to search.",
    };
  }

  const states = (job.states ?? []).map(normalizeState).filter(Boolean);
  const stateText = states.length ? states.join(" ") : "Australia";
  const licenceNumbers = (job.evidence?.licenceNumbers ?? []).filter(Boolean).slice(0, 3);
  const queries = [
    quote(name),
    `${quote(name)} builder ${stateText}`,
    `${quote(name)} home builder ${stateText}`,
    ...licenceNumbers.map((licenceNumber) => `${quote(name)} ${quote(licenceNumber)} builder`),
  ];

  return {
    eligible: true,
    builderId: job.builderId,
    jobId: job.jobId,
    name,
    states,
    queries: [...new Set(queries)],
    maxResultsPerQuery: options.maxResultsPerQuery ?? 10,
    excludedHosts: EXCLUDED_HOSTS,
    constraints: [
      "Use a production search provider or sanctioned directory; do not invent or guess website URLs.",
      "Treat search results as review evidence until the website content corroborates the builder name and licence/business identity.",
      "Directory, social media and association pages may be evidence leads, but they are not the builder's official website.",
    ],
  };
}

export function buildWebsiteDiscoveryJobFromEnrichmentJob(job, options = {}) {
  const plan = buildWebsiteDiscoveryPlanFromJob(job, options);
  if (!plan.eligible) return null;

  return {
    schemaVersion: 1,
    discoveryJobId: `builder-website-discovery:${job.builderId}`,
    builderId: job.builderId,
    enrichmentJobId: job.jobId,
    name: job.name,
    states: job.states ?? [],
    sourceIds: job.sourceIds ?? [],
    sourceManifestGeneratedAt: job.sourceManifestGeneratedAt,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    searchQueries: plan.queries,
    maxResultsPerQuery: plan.maxResultsPerQuery,
    excludedHosts: plan.excludedHosts,
    priorityScore: job.priorityScore ?? 0,
    evidence: {
      licenceCount: job.evidence?.licenceCount ?? 0,
      licenceClasses: job.evidence?.licenceClasses ?? [],
      licenceNumbers: job.evidence?.licenceNumbers ?? [],
      hasWebsite: Boolean(job.evidence?.hasWebsite),
      evidenceQuality: job.evidence?.evidenceQuality ?? {},
    },
    constraints: plan.constraints,
  };
}

export function scoreWebsiteDiscoveryCandidate(job, result) {
  const url = String(result?.url ?? result?.link ?? "").trim();
  const host = getHost(url);
  const title = cleanSearchText(result?.title);
  const snippet = cleanSearchText(result?.snippet ?? result?.description);
  const text = normalizeText([title, snippet, host].filter(Boolean).join(" "));
  const nameTerms = tokenize(job?.name).filter((term) => term.length > 2);
  const matchedNameTerms = nameTerms.filter((term) => text.includes(term));
  const hostExcluded = Boolean(host && EXCLUDED_HOSTS.some((excluded) => host === excluded || host.endsWith(`.${excluded}`)));
  const score = Math.min(100, matchedNameTerms.length * 20 + (hostExcluded ? 0 : 20));

  return {
    schemaVersion: 1,
    builderId: job?.builderId ?? null,
    discoveryJobId: job?.discoveryJobId ?? null,
    url,
    host,
    title,
    snippet,
    candidateStatus: hostExcluded || score < 60 ? "review_required" : "candidate",
    reviewOnly: true,
    autoApply: false,
    score,
    matchedNameTerms,
    exclusionReason: hostExcluded ? "directory_social_or_association_host" : undefined,
    evidence: result,
    constraints: [
      "Do not persist this URL to a builder record until fetched website content corroborates the builder identity.",
    ],
  };
}

export async function writeWebsiteDiscoveryJobs(options = {}) {
  const dataDir = options.dataDir ?? DEFAULT_BUILDER_DATA_DIR;
  const outputDir = options.outputDir ?? dataDir;
  const inputFilename = assertSafeBuilderArtifactFilename(options.inputFilename ?? "builder-enrichment-jobs.ndjson", "website discovery input filename");
  const outputFilename = assertSafeBuilderArtifactFilename(
    options.outputFilename ?? "builder-website-discovery-jobs.ndjson",
    "website discovery output filename"
  );
  const summaryFilename = assertSafeBuilderArtifactFilename(
    options.summaryFilename ?? "builder-website-discovery-summary.json",
    "website discovery summary filename"
  );
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const state = normalizeState(options.state);
  const requestedLimit = Number(options.limit ?? Number.POSITIVE_INFINITY);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.floor(requestedLimit)) : Number.POSITIVE_INFINITY;
  const manifest = await readJson(path.join(dataDir, "manifest.json"));
  const inputPath = path.join(dataDir, inputFilename);
  const outputPath = path.join(outputDir, outputFilename);
  const summaryPath = path.join(outputDir, summaryFilename);
  const hash = createHash("sha256");
  const byState = {};
  let scannedJobs = 0;
  let eligibleJobs = 0;
  let writtenJobs = 0;
  let queryCount = 0;

  await mkdir(outputDir, { recursive: true });
  const output = createWriteStream(outputPath, { encoding: "utf8" });

  try {
    for await (const enrichmentJob of readNdjson(inputPath)) {
      scannedJobs += 1;
      if (state && !enrichmentJob.states?.includes(state)) continue;
      if (!enrichmentJob.suggestedJobs?.includes(WEBSITE_DISCOVERY_JOB)) continue;
      eligibleJobs += 1;

      const job = buildWebsiteDiscoveryJobFromEnrichmentJob(enrichmentJob, { generatedAt, maxResultsPerQuery: options.maxResultsPerQuery });
      if (!job) continue;
      for (const itemState of job.states) byState[itemState] = (byState[itemState] ?? 0) + 1;
      queryCount += job.searchQueries.length;

      const line = `${JSON.stringify(job)}\n`;
      hash.update(line);
      if (!output.write(line)) {
        await new Promise((resolve) => output.once("drain", resolve));
      }
      writtenJobs += 1;
      if (writtenJobs >= limit) break;
    }
  } finally {
    output.end();
    await finished(output);
  }

  const summary = {
    schemaVersion: 1,
    generatedAt,
    sourceManifestGeneratedAt: manifest.generatedAt,
    inputFile: inputFilename,
    outputFile: outputFilename,
    filters: {
      state: state ?? null,
      limit: Number.isFinite(limit) ? limit : null,
    },
    totals: {
      scannedJobs,
      eligibleJobs,
      writtenJobs,
      searchQueries: queryCount,
      importedBuilders: manifest.totals?.builders ?? 0,
    },
    byState,
    files: {
      [outputFilename]: {
        format: "ndjson",
        rowCount: writtenJobs,
        sha256: hash.digest("hex"),
      },
    },
    limitations: [
      "This artifact contains website discovery search plans only; it does not contain verified builder website URLs.",
      "A production search/fetch integration must record source evidence before any website URL can be persisted to a builder record.",
      "Search results from directories, social media or associations are leads for review, not official builder websites.",
    ],
  };

  await writeJsonFile(summaryPath, summary);
  return { outputPath, summaryPath, summary };
}

export async function writeWebsiteDiscoveryCandidates(options = {}) {
  const dataDir = options.dataDir ?? DEFAULT_BUILDER_DATA_DIR;
  const inputFilename = assertSafeBuilderArtifactFilename(
    options.inputFilename ?? "builder-website-search-results.ndjson",
    "website candidate input filename"
  );
  const jobsFilename = assertSafeBuilderArtifactFilename(options.jobsFilename ?? "builder-website-discovery-jobs.ndjson", "website candidate jobs filename");
  const outputFilename = assertSafeBuilderArtifactFilename(options.outputFilename ?? "builder-website-candidates.ndjson", "website candidate output filename");
  const summaryFilename = assertSafeBuilderArtifactFilename(
    options.summaryFilename ?? "builder-website-candidates-summary.json",
    "website candidate summary filename"
  );
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const inputPath = path.join(dataDir, inputFilename);
  const jobsPath = path.join(dataDir, jobsFilename);
  const outputPath = path.join(dataDir, outputFilename);
  const summaryPath = path.join(dataDir, summaryFilename);
  const jobsById = await readWebsiteDiscoveryJobsById(jobsPath);
  const hash = createHash("sha256");
  const byStatus = {};
  const byProvider = {};
  const byState = {};
  let scannedResultRows = 0;
  let expandedResults = 0;
  let skippedResults = 0;
  let writtenCandidates = 0;

  await mkdir(dataDir, { recursive: true });
  await assertNewBuilderArtifactPath(outputPath, outputFilename, { overwrite: options.overwrite });
  await assertNewBuilderArtifactPath(summaryPath, summaryFilename, { overwrite: options.overwrite });
  const output = createWriteStream(outputPath, { encoding: "utf8" });

  try {
    for await (const row of readNdjson(inputPath)) {
      scannedResultRows += 1;
      for (const result of expandSearchResultRow(row)) {
        expandedResults += 1;
        const discoveryJobId = result.discoveryJobId ?? row.discoveryJobId;
        const job = jobsById.get(discoveryJobId) ?? (result.builderId || row.builderId ? [...jobsById.values()].find((item) => item.builderId === (result.builderId ?? row.builderId)) : null);
        if (!job) {
          skippedResults += 1;
          continue;
        }

        const scored = scoreWebsiteDiscoveryCandidate(job, result);
        const candidate = {
          candidateId: makeWebsiteCandidateId(job.discoveryJobId, scored.url, result.query ?? row.query),
          generatedAt,
          provider: result.provider ?? row.provider ?? "unknown",
          query: result.query ?? row.query ?? null,
          rank: Number.isFinite(result.rank) ? result.rank : Number.isFinite(row.rank) ? row.rank : null,
          builderName: job.name,
          states: job.states ?? [],
          sourceIds: job.sourceIds ?? [],
          licenceNumbers: job.evidence?.licenceNumbers ?? [],
          licenceClasses: job.evidence?.licenceClasses ?? [],
          ...scored,
          constraints: [
            ...scored.constraints,
            "Candidate rows are review-only; do not update builder.websiteUrl without a separate fetched-page corroboration record.",
          ],
        };
        if (!candidate.url) {
          skippedResults += 1;
          continue;
        }

        byStatus[candidate.candidateStatus] = (byStatus[candidate.candidateStatus] ?? 0) + 1;
        byProvider[candidate.provider] = (byProvider[candidate.provider] ?? 0) + 1;
        for (const state of candidate.states) byState[state] = (byState[state] ?? 0) + 1;

        const line = `${JSON.stringify(candidate)}\n`;
        hash.update(line);
        if (!output.write(line)) {
          await new Promise((resolve) => output.once("drain", resolve));
        }
        writtenCandidates += 1;
      }
    }
  } finally {
    output.end();
    await finished(output);
  }

  const summary = {
    schemaVersion: 1,
    generatedAt,
    inputFile: inputFilename,
    jobsFile: jobsFilename,
    outputFile: outputFilename,
    totals: {
      discoveryJobs: jobsById.size,
      scannedResultRows,
      expandedResults,
      skippedResults,
      writtenCandidates,
    },
    byStatus,
    byProvider,
    byState,
    files: {
      [outputFilename]: {
        format: "ndjson",
        rowCount: writtenCandidates,
        sha256: hash.digest("hex"),
      },
    },
    limitations: [
      "Candidate rows are scored search-result evidence only; they are not persisted builder website URLs.",
      "Directory, social media and association hosts remain review-required leads, not official website matches.",
      "A separate fetched-page corroboration step must verify builder identity before a URL can be proposed for builder record update.",
    ],
  };

  await writeJsonFile(summaryPath, summary);
  return { outputPath, summaryPath, summary };
}

function getHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return undefined;
  }
}

function cleanSearchText(value) {
  const cleaned = String(value ?? "").replace(/\s+/g, " ").trim();
  return cleaned || undefined;
}

function cleanBuilderSearchName(value) {
  const cleaned = String(value ?? "")
    .replace(/^[^a-z0-9]+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || undefined;
}

function quote(value) {
  return `"${String(value).replaceAll('"', "").trim()}"`;
}

function tokenize(value) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/i)
    .map((term) => term.trim())
    .filter(Boolean);
}

function makeWebsiteCandidateId(discoveryJobId, url, query) {
  const hash = createHash("sha256").update(JSON.stringify([discoveryJobId, url, query ?? null])).digest("hex").slice(0, 16);
  return `builder-website-candidate:${hash}`;
}

async function readWebsiteDiscoveryJobsById(filepath) {
  const jobs = new Map();
  for await (const job of readNdjson(filepath)) {
    jobs.set(job.discoveryJobId, job);
  }
  return jobs;
}

function expandSearchResultRow(row) {
  if (Array.isArray(row.results)) {
    return row.results.map((result, index) => ({
      ...result,
      discoveryJobId: result.discoveryJobId ?? row.discoveryJobId,
      builderId: result.builderId ?? row.builderId,
      provider: result.provider ?? row.provider,
      query: result.query ?? row.query,
      rank: Number.isFinite(result.rank) ? result.rank : index + 1,
    }));
  }
  return [row];
}

async function readJson(filepath) {
  return JSON.parse(await readFile(filepath, "utf8"));
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
