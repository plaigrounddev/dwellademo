#!/usr/bin/env node
import { DEFAULT_BUILDER_DATA_DIR, writeDetailedListAudit } from "../src/backend/index.js";

const options = parseArgs(process.argv.slice(2));
const result = await writeDetailedListAudit(options);

console.log(
  JSON.stringify(
    {
      outputPath: result.outputPath,
      ...result.audit,
    },
    null,
    2
  )
);

if (options.failOnHardFailures && result.audit.hardFailures.length) process.exit(1);

function parseArgs(args) {
  const parsed = {
    dataDir: DEFAULT_BUILDER_DATA_DIR,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--data-dir") {
      parsed.dataDir = args[++index];
    } else if (arg === "--input-file") {
      parsed.inputFilename = args[++index];
    } else if (arg === "--output-file") {
      parsed.outputFilename = args[++index];
    } else if (arg === "--generated-at") {
      parsed.generatedAt = args[++index];
    } else if (arg === "--sample-limit") {
      parsed.sampleLimit = Number(args[++index]);
      if (!Number.isFinite(parsed.sampleLimit) || parsed.sampleLimit < 0) usage("--sample-limit must be zero or a positive number");
    } else if (arg === "--fail-on-hard-failures") {
      parsed.failOnHardFailures = true;
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
  node scripts/generate-builder-detailed-list-audit.mjs [--data-dir data/builders] [--sample-limit 10]
  node scripts/generate-builder-detailed-list-audit.mjs --fail-on-hard-failures`);
  process.exit(error ? 1 : 0);
}
