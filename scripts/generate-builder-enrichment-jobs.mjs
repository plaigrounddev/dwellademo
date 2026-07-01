#!/usr/bin/env node
import { DEFAULT_BUILDER_DATA_DIR, writeBuilderEnrichmentJobs } from "../src/backend/index.js";

const options = parseArgs(process.argv.slice(2));
const result = await writeBuilderEnrichmentJobs(options);

console.log(JSON.stringify({
  status: "ok",
  outputPath: result.outputPath,
  summaryPath: result.summaryPath,
  totals: result.summary.totals,
  gapCounts: result.summary.gapCounts,
  suggestedJobCounts: result.summary.suggestedJobCounts,
  sha256: result.summary.files["builder-enrichment-jobs.ndjson"].sha256,
}, null, 2));

function parseArgs(args) {
  const options = {
    dataDir: DEFAULT_BUILDER_DATA_DIR,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--data-dir") {
      options.dataDir = args[++index];
    } else if (arg === "--output-dir") {
      options.outputDir = args[++index];
    } else if (arg === "--state") {
      options.state = args[++index];
    } else if (arg === "--gap") {
      options.gap = args[++index];
    } else if (arg === "--generated-at") {
      options.generatedAt = args[++index];
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
  node scripts/generate-builder-enrichment-jobs.mjs [--data-dir data/builders] [--output-dir data/builders] [--state QLD] [--gap business_identity|website_discovery|website_enrichment|service_region|address]`);
  process.exit(error ? 1 : 0);
}
