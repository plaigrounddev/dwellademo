#!/usr/bin/env node
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import {
  DEFAULT_BUILDER_DATA_DIR,
  DEFAULT_CONVEX_BUILDER_BATCH_SIZE,
  assertExpectedImportRows,
  artifactPaths,
  readBuilderAbnMergeConvexImportMetadata,
  readNdjsonMappedBatches,
  toConvexAbnMergeProposal,
} from "../src/backend/index.js";
import { loadLocalEnv } from "./load-local-env.mjs";

await loadLocalEnv();
const options = parseArgs(process.argv.slice(2));
const metadata = await readBuilderAbnMergeConvexImportMetadata(options.dataDir);
const paths = artifactPaths(options.dataDir);
let rows = 0;

if (options.dryRun) {
  for await (const batch of readNdjsonMappedBatches(paths.abnMergeProposals, toConvexAbnMergeProposal, options.batchSize)) rows += batch.length;
  assertExpectedImportRows("builder ABN merge Convex dry run", rows, metadata.expectedRows);
  printJson({ status: "dry_run_ok", importId: metadata.importId, expectedRows: metadata.expectedRows, rows });
  process.exit(0);
}

const client = new ConvexHttpClient(options.convexUrl ?? process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL);
await client.mutation(api.builderMemory.upsertAbnMergeRun, metadata.abnMergeRun);
for await (const batch of readNdjsonMappedBatches(paths.abnMergeProposals, toConvexAbnMergeProposal, options.batchSize)) {
  await client.mutation(api.builderMemory.upsertAbnMergeProposalBatch, { importId: metadata.importId, proposals: batch });
  rows += batch.length;
}
assertExpectedImportRows("builder ABN merge Convex import", rows, metadata.expectedRows);
await client.mutation(api.builderMemory.finalizeAbnMergeRun, { importId: metadata.importId, loadedRows: rows });
printJson({ status: "imported", importId: metadata.importId, expectedRows: metadata.expectedRows, rows });

function parseArgs(args) {
  const parsed = { dataDir: DEFAULT_BUILDER_DATA_DIR, batchSize: DEFAULT_CONVEX_BUILDER_BATCH_SIZE, dryRun: false };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--data-dir") parsed.dataDir = args[++i];
    else if (arg === "--batch-size") parsed.batchSize = Number(args[++i]);
    else if (arg === "--convex-url") parsed.convexUrl = args[++i];
    else if (arg === "--dry-run") parsed.dryRun = true;
    else if (arg === "--help" || arg === "-h") usage();
    else usage(`Unknown argument: ${arg}`);
  }
  if (!parsed.dryRun && !(parsed.convexUrl ?? process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL)) throw new Error("Missing Convex URL. Set CONVEX_URL or VITE_CONVEX_URL, or run with --dry-run.");
  return parsed;
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function usage(error) {
  if (error) console.error(error);
  console.error("Usage: node scripts/import-builder-abn-merge-proposals-to-convex.mjs --dry-run [--data-dir data/builders]");
  process.exit(error ? 1 : 0);
}
