#!/usr/bin/env node
import { DEFAULT_BUILDER_DATA_DIR, writeWebsiteSearchRequests } from "../src/backend/index.js";

const options = parseArgs(process.argv.slice(2));
const result = await writeWebsiteSearchRequests(options);

console.log(
  JSON.stringify(
    {
      status: "ok",
      outputPath: result.outputPath,
      summaryPath: result.summaryPath,
      ...result.summary,
    },
    null,
    2
  )
);

function parseArgs(args) {
  const parsed = {
    dataDir: DEFAULT_BUILDER_DATA_DIR,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--data-dir") {
      parsed.dataDir = args[++index];
    } else if (arg === "--output-dir") {
      parsed.outputDir = args[++index];
    } else if (arg === "--state") {
      parsed.state = args[++index];
    } else if (arg === "--limit") {
      parsed.limit = Number(args[++index]);
      if (!Number.isFinite(parsed.limit) || parsed.limit < 1) usage("--limit must be a positive number");
    } else if (arg === "--generated-at") {
      parsed.generatedAt = args[++index];
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
  node scripts/generate-builder-website-search-requests.mjs [--data-dir data/builders] [--state QLD] [--limit 1000]`);
  process.exit(error ? 1 : 0);
}
