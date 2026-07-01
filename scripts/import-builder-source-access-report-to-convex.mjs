#!/usr/bin/env node
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { DEFAULT_BUILDER_DATA_DIR, readBuilderConvexImportMetadata } from "../src/backend/index.js";
import { loadLocalEnv } from "./load-local-env.mjs";

await loadLocalEnv();
const options = parseArgs(process.argv.slice(2));
const metadata = await readBuilderConvexImportMetadata(options.dataDir);

if (options.dryRun) {
  printJson({
    status: "dry_run_ok",
    importId: metadata.importId,
    generatedAt: metadata.sourceAccessReport.generatedAt,
    importedStates: metadata.sourceAccessReport.importedStates,
    pendingStates: metadata.sourceAccessReport.pendingStates,
  });
  process.exit(0);
}

const convexUrl = options.convexUrl ?? process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL;
if (!convexUrl) throw new Error("Missing Convex URL. Set CONVEX_URL or VITE_CONVEX_URL, or run with --dry-run.");

const client = new ConvexHttpClient(convexUrl);
await client.mutation(api.builderMemory.upsertSourceAccessReport, metadata.sourceAccessReport);

printJson({
  status: "imported",
  importId: metadata.importId,
  generatedAt: metadata.sourceAccessReport.generatedAt,
  importedStates: metadata.sourceAccessReport.importedStates,
  pendingStates: metadata.sourceAccessReport.pendingStates,
});

function parseArgs(args) {
  const parsed = {
    dataDir: DEFAULT_BUILDER_DATA_DIR,
    dryRun: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--data-dir") {
      parsed.dataDir = args[++index];
    } else if (arg === "--convex-url") {
      parsed.convexUrl = args[++index];
    } else if (arg === "--dry-run") {
      parsed.dryRun = true;
    } else if (arg === "--help" || arg === "-h") {
      usage();
    } else {
      usage(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function usage(error) {
  if (error) console.error(error);
  console.error(`Usage:
  node scripts/import-builder-source-access-report-to-convex.mjs --dry-run [--data-dir data/builders]
  node scripts/import-builder-source-access-report-to-convex.mjs [--data-dir data/builders]`);
  process.exit(error ? 1 : 0);
}
