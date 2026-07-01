#!/usr/bin/env node
import {
  DEFAULT_BUILDER_DATA_DIR,
  writeWebsiteDiscoveryCandidates,
} from "../src/backend/index.js";

const options = parseArgs(process.argv.slice(2));
const result = await writeWebsiteDiscoveryCandidates(options);

console.log(JSON.stringify({
  status: "ok",
  outputPath: result.outputPath,
  summaryPath: result.summaryPath,
  ...result.summary,
}, null, 2));

function parseArgs(args) {
  const parsed = {
    dataDir: DEFAULT_BUILDER_DATA_DIR,
    inputFilename: "builder-website-search-results.ndjson",
    jobsFilename: "builder-website-discovery-jobs.ndjson",
    outputFilename: "builder-website-candidates.ndjson",
    summaryFilename: "builder-website-candidates-summary.json",
    overwrite: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--data-dir") {
      parsed.dataDir = args[++index];
    } else if (arg === "--input-file") {
      parsed.inputFilename = args[++index];
    } else if (arg === "--jobs-file") {
      parsed.jobsFilename = args[++index];
    } else if (arg === "--output-file") {
      parsed.outputFilename = args[++index];
    } else if (arg === "--summary-file") {
      parsed.summaryFilename = args[++index];
    } else if (arg === "--generated-at") {
      parsed.generatedAt = args[++index];
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

function usage(error) {
  if (error) console.error(error);
  console.error(`Usage:
  node scripts/generate-builder-website-candidates.mjs --input-file builder-website-search-results.ndjson [--data-dir data/builders] [--overwrite]

Consumes real search-provider result evidence and writes review-only website candidates. It does not guess or persist builder website URLs.`);
  process.exit(error ? 1 : 0);
}
