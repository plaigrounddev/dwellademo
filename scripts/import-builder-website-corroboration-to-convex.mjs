#!/usr/bin/env node
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import {
  DEFAULT_BUILDER_DATA_DIR,
  DEFAULT_CONVEX_BUILDER_BATCH_SIZE,
  assertExpectedImportRows,
  artifactPaths,
  readBuilderWebsiteCorroborationConvexImportMetadata,
  readNdjsonMappedBatches,
  toConvexWebsiteCorroboration,
} from "../src/backend/index.js";
import { loadLocalEnv } from "./load-local-env.mjs";

await loadLocalEnv();
const options = parseArgs(process.argv.slice(2));
const startedAt = Date.now();
const metadata = await readBuilderWebsiteCorroborationConvexImportMetadata(options.dataDir);
const paths = artifactPaths(options.dataDir);
let rows = 0;

if (options.dryRun) {
  for await (const batch of readNdjsonMappedBatches(paths.websiteCorroborations, toConvexWebsiteCorroboration, options.batchSize)) {
    rows += batch.length;
  }
  assertExpectedImportRows("builder website corroboration Convex dry run", rows, metadata.expectedRows);
  printJson({ status: "dry_run_ok", importId: metadata.importId, expectedRows: metadata.expectedRows, rows, elapsedMs: Date.now() - startedAt });
  process.exit(0);
}

const convexUrl = options.convexUrl ?? process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL;
if (!convexUrl) throw new Error("Missing Convex URL. Set CONVEX_URL or VITE_CONVEX_URL, or run with --dry-run.");

const client = new ConvexHttpClient(convexUrl);
await runWithRetry("website corroboration run manifest", () => client.mutation(api.builderMemory.upsertWebsiteCorroborationRun, metadata.websiteCorroborationRun));

let batchNumber = 0;
for await (const batch of readNdjsonMappedBatches(paths.websiteCorroborations, toConvexWebsiteCorroboration, options.batchSize)) {
  batchNumber += 1;
  await runWithRetry(`website corroboration batch ${batchNumber}`, () =>
    client.mutation(api.builderMemory.upsertWebsiteCorroborationBatch, {
      importId: metadata.importId,
      corroborations: batch,
    })
  );
  rows += batch.length;
  if (!options.quiet && (batchNumber === 1 || batchNumber % 100 === 0)) console.error(`websiteCorroborations: ${rows} rows imported`);
}

assertExpectedImportRows("builder website corroboration Convex import", rows, metadata.expectedRows);
await runWithRetry("website corroboration import finalization", () =>
  client.mutation(api.builderMemory.finalizeWebsiteCorroborationRun, { importId: metadata.importId, loadedRows: rows })
);

printJson({ status: "imported", importId: metadata.importId, expectedRows: metadata.expectedRows, rows, elapsedMs: Date.now() - startedAt });

async function runWithRetry(label, operation) {
  let lastError;
  for (let attempt = 1; attempt <= options.maxRetries + 1; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt > options.maxRetries) break;
      const delayMs = Math.min(30000, 1000 * 2 ** (attempt - 1));
      if (!options.quiet) console.error(`${label} failed on attempt ${attempt}; retrying in ${delayMs}ms: ${error instanceof Error ? error.message : String(error)}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

function parseArgs(args) {
  const parsed = { dataDir: DEFAULT_BUILDER_DATA_DIR, batchSize: DEFAULT_CONVEX_BUILDER_BATCH_SIZE, dryRun: false, maxRetries: 5, quiet: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--data-dir") parsed.dataDir = args[++index];
    else if (arg === "--batch-size") parsed.batchSize = Number(args[++index]);
    else if (arg === "--convex-url") parsed.convexUrl = args[++index];
    else if (arg === "--max-retries") parsed.maxRetries = Number(args[++index]);
    else if (arg === "--dry-run") parsed.dryRun = true;
    else if (arg === "--quiet") parsed.quiet = true;
    else if (arg === "--help" || arg === "-h") usage();
    else usage(`Unknown argument: ${arg}`);
  }
  if (!Number.isFinite(parsed.batchSize) || parsed.batchSize < 1 || parsed.batchSize > 500) usage("--batch-size must be between 1 and 500");
  if (!Number.isFinite(parsed.maxRetries) || parsed.maxRetries < 0 || parsed.maxRetries > 10) usage("--max-retries must be between 0 and 10");
  return parsed;
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function usage(error) {
  if (error) console.error(error);
  console.error(`Usage:
  node scripts/import-builder-website-corroboration-to-convex.mjs --dry-run [--data-dir data/builders]
  CONVEX_URL=https://... node scripts/import-builder-website-corroboration-to-convex.mjs [--data-dir data/builders] [--batch-size 100]`);
  process.exit(error ? 1 : 0);
}
