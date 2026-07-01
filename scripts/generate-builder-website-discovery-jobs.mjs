#!/usr/bin/env node
import {
  DEFAULT_BUILDER_DATA_DIR,
  writeWebsiteDiscoveryJobs,
} from "../src/backend/index.js";

const options = parseArgs(process.argv.slice(2));
const result = await writeWebsiteDiscoveryJobs(options);

console.log(JSON.stringify({
  status: "ok",
  outputPath: result.outputPath,
  summaryPath: result.summaryPath,
  ...result.summary,
}, null, 2));

function parseArgs(args) {
  const parsed = {
    dataDir: DEFAULT_BUILDER_DATA_DIR,
    outputDir: DEFAULT_BUILDER_DATA_DIR,
    inputFilename: "builder-enrichment-jobs.ndjson",
    outputFilename: "builder-website-discovery-jobs.ndjson",
    summaryFilename: "builder-website-discovery-summary.json",
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--data-dir") {
      parsed.dataDir = args[++index];
    } else if (arg === "--output-dir") {
      parsed.outputDir = args[++index];
    } else if (arg === "--input-file") {
      parsed.inputFilename = args[++index];
    } else if (arg === "--output-file") {
      parsed.outputFilename = args[++index];
    } else if (arg === "--summary-file") {
      parsed.summaryFilename = args[++index];
    } else if (arg === "--generated-at") {
      parsed.generatedAt = args[++index];
    } else if (arg === "--state") {
      parsed.state = String(args[++index]).trim().toUpperCase();
    } else if (arg === "--limit") {
      parsed.limit = Number(args[++index]);
      if (!Number.isFinite(parsed.limit) || parsed.limit < 1) usage("--limit must be a positive number");
    } else if (arg === "--max-results-per-query") {
      parsed.maxResultsPerQuery = Number(args[++index]);
      if (!Number.isFinite(parsed.maxResultsPerQuery) || parsed.maxResultsPerQuery < 1 || parsed.maxResultsPerQuery > 100) {
        usage("--max-results-per-query must be between 1 and 100");
      }
    } else if (arg === "--help" || arg === "-h") {
      usage();
    } else {
      usage(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function usage(error) {
  if (error) console.error(error);
  console.error(`Usage:
  node scripts/generate-builder-website-discovery-jobs.mjs [--data-dir data/builders] [--state QLD] [--limit 1000]

Creates compact website-discovery search plans from real enrichment queue rows. It does not guess or persist website URLs.`);
  process.exit(error ? 1 : 0);
}
