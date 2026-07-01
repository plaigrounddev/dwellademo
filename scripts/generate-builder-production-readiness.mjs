#!/usr/bin/env node
import { DEFAULT_BUILDER_DATA_DIR, writeBuilderProductionReadinessReport } from "../src/backend/index.js";

const options = parseArgs(process.argv.slice(2));
const report = await writeBuilderProductionReadinessReport(options);

console.log(
  JSON.stringify(
    {
      status: report.status,
      generatedAt: report.generatedAt,
      builders: report.summary.builders,
      licences: report.summary.licences,
      importedStates: report.summary.importedStates,
      pendingStates: report.summary.pendingStates,
      blockers: report.blockers.map((blocker) => blocker.blockerId),
    },
    null,
    2
  )
);

if (options.failOnNotReady && report.status !== "production_ready") process.exit(1);

function parseArgs(args) {
  const parsed = {
    dataDir: DEFAULT_BUILDER_DATA_DIR,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--data-dir") {
      parsed.dataDir = args[++index];
    } else if (arg === "--output-file") {
      parsed.outputFile = args[++index];
    } else if (arg === "--generated-at") {
      parsed.generatedAt = args[++index];
    } else if (arg === "--fail-on-not-ready") {
      parsed.failOnNotReady = true;
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
  node scripts/generate-builder-production-readiness.mjs [--data-dir data/builders] [--output-file builder-production-readiness.json]
  node scripts/generate-builder-production-readiness.mjs --fail-on-not-ready`);
  process.exit(error ? 1 : 0);
}
