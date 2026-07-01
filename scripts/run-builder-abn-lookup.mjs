#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { finished } from "node:stream/promises";
import path from "node:path";
import {
  DEFAULT_BUILDER_DATA_DIR,
  assertNewBuilderArtifactPath,
  assertSafeBuilderArtifactFilename,
  buildAbnLookupPlanFromJob,
  createAbnLookupClient,
  runAbnLookupForJob,
} from "../src/backend/index.js";
import { loadLocalEnv } from "./load-local-env.mjs";

await loadLocalEnv();
const options = parseArgs(process.argv.slice(2));
const checkedAt = options.checkedAt ?? new Date().toISOString();
const jobsPath = path.join(options.dataDir, "builder-enrichment-jobs.ndjson");
const outputFilename = assertSafeBuilderArtifactFilename(options.outputFilename, "ABN lookup output filename");
const summaryFilename = assertSafeBuilderArtifactFilename(options.summaryFilename, "ABN lookup summary filename");
const outputPath = path.join(options.outputDir, outputFilename);
const summaryPath = path.join(options.outputDir, summaryFilename);
const plans = [];
const selectedJobs = [];
const results = [];
let scannedJobs = 0;
let eligibleJobs = 0;

await mkdir(options.outputDir, { recursive: true });

for await (const job of readNdjson(jobsPath)) {
  scannedJobs += 1;
  if (options.builderId && job.builderId !== options.builderId) continue;
  if (options.state && !job.states?.includes(options.state)) continue;
  if (!job.suggestedJobs?.includes("abn_lookup_identity_match")) continue;
  const plan = buildAbnLookupPlanFromJob(job, { maxResults: options.maxResults });
  if (!plan.eligible) continue;
  eligibleJobs += 1;
  plans.push(plan);
  selectedJobs.push(job);
  if (plans.length >= options.limit) break;
}

if (!options.write) {
  printJson({
    status: "dry_run_ok",
    checkedAt,
    scannedJobs,
    eligibleJobs,
    selectedJobs: plans.length,
    plans,
    limitations: [
      "Dry run does not call ABN Lookup and does not create identity evidence.",
      "Live mode requires --write and ABN_LOOKUP_GUID.",
    ],
  });
  process.exit(0);
}

const guid = options.guid ?? process.env.ABN_LOOKUP_GUID;
if (!guid) {
  throw new Error("Missing ABN_LOOKUP_GUID. Live ABN Lookup mode requires --write plus a real ABN Lookup GUID.");
}
await assertNewBuilderArtifactPath(outputPath, outputFilename, { overwrite: options.overwrite });
await assertNewBuilderArtifactPath(summaryPath, summaryFilename, { overwrite: options.overwrite });
const client = createAbnLookupClient({ guid });
const output = createWriteStream(outputPath, { encoding: "utf8" });
const outputHash = createHash("sha256");

try {
  for (const job of selectedJobs) {
    const result = await runAbnLookupForJob(job, {
      client,
      checkedAt,
      maxResults: options.maxResults,
    });
    results.push(result);
    const line = `${JSON.stringify(result)}\n`;
    outputHash.update(line);
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
  checkedAt,
  source: "ABN_LOOKUP_JSON",
  sourceUrl: "https://abr.business.gov.au/json/",
  scannedJobs,
  eligibleJobs,
  checkedJobs: results.length,
  candidateCount: results.reduce((total, result) => total + (result.candidates?.length ?? 0), 0),
  exactMatchCount: results.reduce((total, result) => total + (result.exactMatches?.length ?? 0), 0),
  outputFile: outputFilename,
  files: {
    [outputFilename]: {
      format: "ndjson",
      rowCount: results.length,
      sha256: outputHash.digest("hex"),
    },
  },
  limitations: [
    "ABN Lookup results are evidence candidates and are not automatically merged into builder records.",
    "Builder records must only be updated by a later verified merge step with source evidence retained.",
  ],
};
await writeJson(summaryPath, summary);

printJson({
  status: "ok",
  outputPath,
  summaryPath,
  ...summary,
});

function parseArgs(args) {
  const parsed = {
    dataDir: DEFAULT_BUILDER_DATA_DIR,
    outputDir: DEFAULT_BUILDER_DATA_DIR,
    outputFilename: "builder-abn-lookup-results.ndjson",
    summaryFilename: "builder-abn-lookup-summary.json",
    limit: 10,
    maxResults: 10,
    write: false,
    overwrite: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--data-dir") {
      parsed.dataDir = args[++index];
    } else if (arg === "--output-dir") {
      parsed.outputDir = args[++index];
    } else if (arg === "--builder-id") {
      parsed.builderId = args[++index];
    } else if (arg === "--state") {
      parsed.state = String(args[++index]).trim().toUpperCase();
    } else if (arg === "--limit") {
      parsed.limit = Number(args[++index]);
      if (!Number.isFinite(parsed.limit) || parsed.limit < 1 || parsed.limit > 1000) usage("--limit must be between 1 and 1000");
    } else if (arg === "--max-results") {
      parsed.maxResults = Number(args[++index]);
      if (!Number.isFinite(parsed.maxResults) || parsed.maxResults < 1 || parsed.maxResults > 100) usage("--max-results must be between 1 and 100");
    } else if (arg === "--guid") {
      parsed.guid = args[++index];
    } else if (arg === "--checked-at") {
      parsed.checkedAt = args[++index];
    } else if (arg === "--write") {
      parsed.write = true;
    } else if (arg === "--overwrite") {
      parsed.overwrite = true;
    } else if (arg === "--help" || arg === "-h") {
      usage();
    } else {
      usage(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

async function* readNdjson(filepath) {
  const rl = createInterface({ input: createReadStream(filepath) });
  for await (const line of rl) {
    if (line.trim()) yield JSON.parse(line);
  }
}

async function writeJson(filepath, value) {
  const output = createWriteStream(filepath, { encoding: "utf8" });
  output.end(`${JSON.stringify(value, null, 2)}\n`);
  await finished(output);
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function usage(error) {
  if (error) console.error(error);
  console.error(`Usage:
  node scripts/run-builder-abn-lookup.mjs [--data-dir data/builders] [--state QLD] [--builder-id builder:...] [--limit 10]
  ABN_LOOKUP_GUID=... node scripts/run-builder-abn-lookup.mjs --write [--limit 10] [--max-results 10]`);
  process.exit(error ? 1 : 0);
}
