#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { DEFAULT_BUILDER_DATA_DIR, readBuilderConvexImportMetadata } from "../src/backend/index.js";
import { loadLocalEnv } from "./load-local-env.mjs";

await loadLocalEnv();
const options = parseArgs(process.argv.slice(2));
const metadata = await readBuilderConvexImportMetadata(options.dataDir);
const expectedRows = metadata.importRun.expectedTotals?.duplicateReviews ?? 0;
let importVerification;
let searchResult;

if (options.mockImportResultFile) {
  importVerification = JSON.parse(await readFile(options.mockImportResultFile, "utf8"));
}
if (options.mockSearchResultFile) {
  searchResult = JSON.parse(await readFile(options.mockSearchResultFile, "utf8"));
}

if (!importVerification || !searchResult) {
  const convexUrl = options.convexUrl ?? process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("Missing Convex URL. Set CONVEX_URL or VITE_CONVEX_URL, or pass mock result files.");
  }
  const client = new ConvexHttpClient(convexUrl);
  if (!importVerification) {
    importVerification = await client.query(api.builderMemory.verifyImportRun, { importId: options.importId ?? metadata.importId });
  }
  if (!searchResult) {
    searchResult = await client.query(api.builderMemory.searchDuplicateReviews, {
      reviewReason: options.reviewReason,
      confidence: options.confidence,
      limit: options.limit,
    });
  }
}

const failures = [];
if (importVerification?.importStatus !== "completed") failures.push("Convex builder import is not marked completed.");
if (importVerification?.loadedTotals?.duplicateReviews !== expectedRows) {
  failures.push(`duplicateReviews loaded ${importVerification?.loadedTotals?.duplicateReviews ?? "missing"} but expected ${expectedRows}.`);
}

const results = searchResult?.results ?? [];
if (expectedRows > 0 && results.length === 0) failures.push("Convex duplicate-review search returned no sample rows.");
for (const [index, row] of results.entries()) {
  const label = `duplicate review sample ${index + 1}`;
  if (!row.id) failures.push(`${label}: missing id.`);
  if (!row.normalizedName) failures.push(`${label}: missing normalizedName.`);
  if (row.reviewOnly !== true) failures.push(`${label}: reviewOnly must be true.`);
  if (row.autoMerge !== false) failures.push(`${label}: autoMerge must be false.`);
  if (!Number.isFinite(row.builderCount) || row.builderCount < 2) failures.push(`${label}: builderCount must be at least 2.`);
  if (!Array.isArray(row.builderIds) || row.builderIds.length !== row.builderCount) {
    failures.push(`${label}: builderIds must match builderCount.`);
  }
  if (!Array.isArray(row.states) || row.states.length === 0) failures.push(`${label}: missing states.`);
}

const result = {
  status: failures.length ? "mismatch" : "ok",
  importId: importVerification?.importId ?? options.importId ?? metadata.importId,
  expectedRows,
  loadedRows: importVerification?.loadedTotals?.duplicateReviews ?? null,
  sampleCount: results.length,
  reviewReason: options.reviewReason ?? null,
  confidence: options.confidence ?? null,
  limitations: searchResult?.limitations ?? [],
  failures,
};

printJson(result);
if (result.status !== "ok") process.exit(1);

function parseArgs(args) {
  const parsed = {
    dataDir: DEFAULT_BUILDER_DATA_DIR,
    limit: 10,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--data-dir") parsed.dataDir = args[++index];
    else if (arg === "--convex-url") parsed.convexUrl = args[++index];
    else if (arg === "--import-id") parsed.importId = args[++index];
    else if (arg === "--review-reason") parsed.reviewReason = args[++index];
    else if (arg === "--confidence") parsed.confidence = args[++index];
    else if (arg === "--limit") {
      parsed.limit = Number(args[++index]);
      if (!Number.isFinite(parsed.limit) || parsed.limit < 1) usage("--limit must be a positive number");
    } else if (arg === "--mock-import-result-file") parsed.mockImportResultFile = args[++index];
    else if (arg === "--mock-search-result-file") parsed.mockSearchResultFile = args[++index];
    else if (arg === "--help" || arg === "-h") usage();
    else usage(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function usage(error) {
  if (error) console.error(error);
  console.error(`Usage:
  CONVEX_URL=https://... node scripts/verify-builder-duplicate-review-convex.mjs [--data-dir data/builders] [--limit 10]
  node scripts/verify-builder-duplicate-review-convex.mjs --mock-import-result-file import.json --mock-search-result-file search.json`);
  process.exit(error ? 1 : 0);
}
