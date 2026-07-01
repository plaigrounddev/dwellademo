#!/usr/bin/env node
import {
  DEFAULT_BUILDER_DATA_DIR,
  writeAbnMergeProposals,
} from "../src/backend/index.js";

const options = parseArgs(process.argv.slice(2));
const result = await writeAbnMergeProposals(options);

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
    inputFilename: "builder-abn-lookup-results.ndjson",
    outputFilename: "builder-abn-merge-proposals.ndjson",
    summaryFilename: "builder-abn-merge-summary.json",
    overwrite: false,
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
  node scripts/generate-builder-abn-merge-proposals.mjs [--data-dir data/builders] [--input-file builder-abn-lookup-results.ndjson] [--overwrite]

Creates review-only ABN/ACN merge proposals from existing ABN Lookup result evidence.`);
  process.exit(error ? 1 : 0);
}
