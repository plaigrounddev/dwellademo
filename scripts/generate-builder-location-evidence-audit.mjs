#!/usr/bin/env node
import {
  DEFAULT_BUILDER_DATA_DIR,
  writeBuilderLocationEvidenceAudit,
} from "../src/backend/index.js";

const options = parseArgs(process.argv.slice(2));
const result = await writeBuilderLocationEvidenceAudit(options);

console.log(JSON.stringify({
  status: "ok",
  outputPath: result.outputPath,
  ...result.audit,
}, null, 2));

function parseArgs(args) {
  const parsed = {
    dataDir: DEFAULT_BUILDER_DATA_DIR,
    outputDir: DEFAULT_BUILDER_DATA_DIR,
    outputFilename: "builder-location-evidence-audit.json",
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--data-dir") {
      parsed.dataDir = args[++index];
    } else if (arg === "--output-dir") {
      parsed.outputDir = args[++index];
    } else if (arg === "--output-file") {
      parsed.outputFilename = args[++index];
    } else if (arg === "--generated-at") {
      parsed.generatedAt = args[++index];
    } else if (arg === "--example-limit") {
      parsed.exampleLimit = Number(args[++index]);
      if (!Number.isFinite(parsed.exampleLimit) || parsed.exampleLimit < 0 || parsed.exampleLimit > 100) {
        usage("--example-limit must be between 0 and 100");
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
  node scripts/generate-builder-location-evidence-audit.mjs [--data-dir data/builders] [--example-limit 10]

Audits whether missing service-region/address fields can be recovered from linked official licence rows.`);
  process.exit(error ? 1 : 0);
}
