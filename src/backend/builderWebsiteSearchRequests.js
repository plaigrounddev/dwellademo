import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { finished } from "node:stream/promises";
import path from "node:path";
import { DEFAULT_BUILDER_DATA_DIR, assertSafeBuilderArtifactFilename } from "./builderArtifacts.js";
import { normalizeState } from "./utils.js";

export async function writeWebsiteSearchRequests(options = {}) {
  const dataDir = options.dataDir ?? DEFAULT_BUILDER_DATA_DIR;
  const outputDir = options.outputDir ?? dataDir;
  const inputFilename = assertSafeBuilderArtifactFilename(
    options.inputFilename ?? "builder-website-discovery-jobs.ndjson",
    "website search request input filename"
  );
  const outputFilename = assertSafeBuilderArtifactFilename(
    options.outputFilename ?? "builder-website-search-requests.ndjson",
    "website search request output filename"
  );
  const summaryFilename = assertSafeBuilderArtifactFilename(
    options.summaryFilename ?? "builder-website-search-requests-summary.json",
    "website search request summary filename"
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
  let writtenRequests = 0;

  await mkdir(outputDir, { recursive: true });
  const output = createWriteStream(outputPath, { encoding: "utf8" });

  try {
    for await (const job of readNdjson(inputPath)) {
      scannedJobs += 1;
      if (state && !job.states?.includes(state)) continue;
      if (!Array.isArray(job.searchQueries) || job.searchQueries.length === 0) continue;
      eligibleJobs += 1;

      for (const query of job.searchQueries) {
        const request = buildWebsiteSearchRequest(job, query, generatedAt);
        for (const itemState of request.states) byState[itemState] = (byState[itemState] ?? 0) + 1;
        const line = `${JSON.stringify(request)}\n`;
        hash.update(line);
        if (!output.write(line)) {
          await new Promise((resolve) => output.once("drain", resolve));
        }
        writtenRequests += 1;
        if (writtenRequests >= limit) break;
      }
      if (writtenRequests >= limit) break;
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
      writtenRequests,
      importedBuilders: manifest.totals?.builders ?? 0,
    },
    byState,
    files: {
      [outputFilename]: {
        format: "ndjson",
        rowCount: writtenRequests,
        sha256: hash.digest("hex"),
      },
    },
    limitations: [
      "This artifact contains search requests only; it does not contain search results or verified builder website URLs.",
      "Rows must be executed by a production search provider before website candidates can be generated.",
      "Search requests are operational work items and must not be treated as evidence that a website exists.",
    ],
  };
  await writeJsonFile(summaryPath, summary);
  return { outputPath, summaryPath, summary };
}

export function buildWebsiteSearchRequest(job, query, generatedAt) {
  const cleanQuery = String(query ?? "").trim();
  return {
    schemaVersion: 1,
    requestId: `builder-website-search:${stableHash([job.discoveryJobId, cleanQuery])}`,
    generatedAt,
    discoveryJobId: job.discoveryJobId,
    builderId: job.builderId,
    enrichmentJobId: job.enrichmentJobId,
    builderName: job.name,
    states: job.states ?? [],
    sourceIds: job.sourceIds ?? [],
    query: cleanQuery,
    maxResults: job.maxResultsPerQuery ?? 10,
    excludedHosts: job.excludedHosts ?? [],
    evidence: {
      licenceCount: job.evidence?.licenceCount ?? 0,
      licenceNumbers: job.evidence?.licenceNumbers ?? [],
      licenceClasses: job.evidence?.licenceClasses ?? [],
      hasWebsite: Boolean(job.evidence?.hasWebsite),
      evidenceQuality: job.evidence?.evidenceQuality ?? {},
    },
    requestStatus: "pending_search_provider",
    constraints: [
      "Do not infer a website URL from this request.",
      "Only write search results returned by a production search provider.",
      "Preserve provider, query, rank, URL, title and snippet in the result evidence.",
    ],
  };
}

function stableHash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 20);
}

async function readJson(filepath) {
  return JSON.parse(await readFile(filepath, "utf8"));
}

async function writeJsonFile(filepath, value) {
  const output = createWriteStream(filepath, { encoding: "utf8" });
  output.end(`${JSON.stringify(value, null, 2)}\n`);
  await finished(output);
}

async function* readNdjson(filepath) {
  const rl = createInterface({ input: createReadStream(filepath) });
  for await (const line of rl) {
    if (line.trim()) yield JSON.parse(line);
  }
}
