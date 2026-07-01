#!/usr/bin/env node
import { DEFAULT_BUILDER_DATA_DIR, writeDetailedBuilderList } from "../src/backend/index.js";

const options = parseArgs(process.argv.slice(2));
const summary = await writeDetailedBuilderList(options);
console.log(JSON.stringify(summary, null, 2));

function parseArgs(args) {
  const options = {
    dataDir: DEFAULT_BUILDER_DATA_DIR,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--data-dir") {
      options.dataDir = args[++index];
    } else if (arg === "--limit") {
      options.limit = Number(args[++index]);
      if (!Number.isFinite(options.limit) || options.limit < 1) usage("--limit must be a positive number");
    } else if (arg === "--output-ndjson") {
      options.outputNdjson = args[++index];
    } else if (arg === "--output-csv") {
      options.outputCsv = args[++index];
    } else if (arg === "--output-summary") {
      options.outputSummary = args[++index];
    } else if (arg === "--help" || arg === "-h") {
      usage();
    } else {
      usage(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function usage(error) {
  if (error) console.error(error);
  console.error(`Usage:
  node scripts/generate-builder-detailed-list.mjs [--data-dir data/builders] [--limit 100]
    [--output-ndjson builder-detailed-list.ndjson]
    [--output-csv builder-detailed-list.csv]
    [--output-summary builder-detailed-list-summary.json]`);
  process.exit(error ? 1 : 0);
}
