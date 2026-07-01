#!/usr/bin/env node
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import {
  DEFAULT_BUILDER_DATA_DIR,
  DEFAULT_CONVEX_BUILDER_BATCH_SIZE,
  assertExpectedImportTotals,
  artifactPaths,
  readBuilderConvexImportMetadata,
  readNdjsonMappedBatches,
  toConvexBuilder,
  toConvexDuplicateReview,
  toConvexLicence,
  toConvexMemoryCard,
  toConvexSearchFacets,
} from "../src/backend/index.js";
import { loadLocalEnv } from "./load-local-env.mjs";

await loadLocalEnv();
const options = parseArgs(process.argv.slice(2));
const startedAt = Date.now();
const metadata = await readBuilderConvexImportMetadata(options.dataDir);
const paths = artifactPaths(options.dataDir);
const totals = {
  builders: 0,
  licences: 0,
  memoryCards: 0,
  searchFacets: 0,
  duplicateReviews: 0,
};

if (options.dryRun) {
  await countBatches("builders", paths.builders, toConvexBuilder);
  await countBatches("licences", paths.licences, toConvexLicence);
  await countBatches("memoryCards", paths.memoryCards, toConvexMemoryCard);
  await countBatches("searchFacets", paths.searchRows, toConvexSearchFacets);
  await countBatches("duplicateReviews", paths.duplicateReviews, toConvexDuplicateReview);
  assertExpectedImportTotals("builder Convex dry run", totals, metadata.importRun.expectedTotals);
  printJson({
    status: "dry_run_ok",
    importId: metadata.importId,
    generatedAt: metadata.importRun.generatedAt,
    importedStates: metadata.importRun.importedStates,
    pendingStates: metadata.importRun.pendingStates,
    totals,
    elapsedMs: Date.now() - startedAt,
  });
  process.exit(0);
}

const convexUrl = options.convexUrl ?? process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL;
if (!convexUrl) {
  throw new Error("Missing Convex URL. Set CONVEX_URL or VITE_CONVEX_URL, or run with --dry-run.");
}

const client = new ConvexHttpClient(convexUrl);
await runWithRetry("import run manifest", () => client.mutation(api.builderMemory.upsertImportRun, metadata.importRun));
await runWithRetry("source access report", () => client.mutation(api.builderMemory.upsertSourceAccessReport, metadata.sourceAccessReport));
await sendBatches("builders", paths.builders, toConvexBuilder, api.builderMemory.upsertBuilderBatch, "builders");
await sendBatches("licences", paths.licences, toConvexLicence, api.builderMemory.upsertLicenceBatch, "licences");
await sendBatches("memoryCards", paths.memoryCards, toConvexMemoryCard, api.builderMemory.upsertMemoryCardBatch, "memoryCards");
await sendBatches("searchFacets", paths.searchRows, toConvexSearchFacets, api.builderMemory.upsertSearchFacetBatch, "facets");
await sendBatches("duplicateReviews", paths.duplicateReviews, toConvexDuplicateReview, api.builderMemory.upsertDuplicateReviewBatch, "duplicateReviews");
assertExpectedImportTotals("builder Convex import", totals, metadata.importRun.expectedTotals);
await runWithRetry("import finalization", () =>
  client.mutation(api.builderMemory.finalizeImportRun, {
    importId: metadata.importId,
    loadedTotals: totals,
  })
);

printJson({
  status: "imported",
  importId: metadata.importId,
  generatedAt: metadata.importRun.generatedAt,
  totals,
  elapsedMs: Date.now() - startedAt,
});

async function countBatches(counterName, filepath, mapper) {
  for await (const batch of readNdjsonMappedBatches(filepath, mapper, options.batchSize)) {
    totals[counterName] += batch.length;
  }
}

async function sendBatches(counterName, filepath, mapper, mutationRef, argName) {
  let batchNumber = 0;
  for await (const batch of readNdjsonMappedBatches(filepath, mapper, options.batchSize)) {
    batchNumber += 1;
    await runWithRetry(`${counterName} batch ${batchNumber}`, () =>
      client.mutation(mutationRef, {
        importId: metadata.importId,
        [argName]: batch,
      })
    );
    totals[counterName] += batch.length;
    if (!options.quiet && (batchNumber === 1 || batchNumber % 100 === 0)) {
      console.error(`${counterName}: ${totals[counterName]} rows imported`);
    }
  }
}

async function runWithRetry(label, operation) {
  let lastError;
  for (let attempt = 1; attempt <= options.maxRetries + 1; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt > options.maxRetries) break;
      const delayMs = Math.min(30000, 1000 * 2 ** (attempt - 1));
      if (!options.quiet) {
        console.error(`${label} failed on attempt ${attempt}; retrying in ${delayMs}ms: ${error instanceof Error ? error.message : String(error)}`);
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

function parseArgs(args) {
  const parsed = {
    dataDir: DEFAULT_BUILDER_DATA_DIR,
    batchSize: DEFAULT_CONVEX_BUILDER_BATCH_SIZE,
    dryRun: false,
    maxRetries: 5,
    quiet: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--data-dir") {
      parsed.dataDir = args[++index];
    } else if (arg === "--batch-size") {
      parsed.batchSize = Number(args[++index]);
      if (!Number.isFinite(parsed.batchSize) || parsed.batchSize < 1 || parsed.batchSize > 500) {
        usage("--batch-size must be between 1 and 500");
      }
    } else if (arg === "--convex-url") {
      parsed.convexUrl = args[++index];
    } else if (arg === "--max-retries") {
      parsed.maxRetries = Number(args[++index]);
      if (!Number.isFinite(parsed.maxRetries) || parsed.maxRetries < 0 || parsed.maxRetries > 10) {
        usage("--max-retries must be between 0 and 10");
      }
    } else if (arg === "--dry-run") {
      parsed.dryRun = true;
    } else if (arg === "--quiet") {
      parsed.quiet = true;
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
  node scripts/import-builders-to-convex.mjs --dry-run [--data-dir data/builders] [--batch-size 100]
  CONVEX_URL=https://... node scripts/import-builders-to-convex.mjs [--data-dir data/builders] [--batch-size 100] [--max-retries 5]`);
  process.exit(error ? 1 : 0);
}
