#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import {
  DEFAULT_BUILDER_DATA_DIR,
  readBuilderDetailedListConvexImportMetadata,
  verifyConvexDetailedListRun,
} from "../src/backend/index.js";
import { loadLocalEnv } from "./load-local-env.mjs";

await loadLocalEnv();
const options = parseArgs(process.argv.slice(2));
const metadata = await readBuilderDetailedListConvexImportMetadata(options.dataDir);
let verification;

if (options.mockResultFile) {
  verification = JSON.parse(await readFile(options.mockResultFile, "utf8"));
} else {
  const convexUrl = options.convexUrl ?? process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL;
  if (!convexUrl) throw new Error("Missing Convex URL. Set CONVEX_URL or VITE_CONVEX_URL, or pass --mock-result-file for local verification tests.");
  const client = new ConvexHttpClient(convexUrl);
  try {
    verification = await client.query(api.builderMemory.verifyDetailedListRun, { importId: options.importId ?? metadata.importId });
  } catch (error) {
    printJson({
      status: "unavailable",
      importId: options.importId ?? metadata.importId,
      expectedRows: metadata.expectedRows,
      failures: [
        `Convex detailed builder list verification query failed: ${error instanceof Error ? error.message : String(error)}`,
        "Deploy the Convex builderMemory functions before verifying a live detailed list import.",
      ],
    });
    process.exit(1);
  }
}

const localCheck = verifyConvexDetailedListRun(metadata.expectedRows, verification);
const result = {
  status: localCheck.ok && verification?.ok ? "ok" : "mismatch",
  importId: verification?.importId ?? options.importId ?? metadata.importId,
  generatedAt: verification?.generatedAt ?? metadata.detailedListRun.generatedAt,
  sourceManifestGeneratedAt: verification?.sourceManifestGeneratedAt ?? metadata.detailedListRun.sourceManifestGeneratedAt,
  expectedRows: metadata.expectedRows,
  loadedRows: verification?.loadedRows ?? null,
  totals: verification?.totals ?? null,
  evidenceCounts: verification?.evidenceCounts ?? null,
  limitationCounts: verification?.limitationCounts ?? null,
  ndjsonSha256: verification?.ndjsonSha256 ?? null,
  csvSha256: verification?.csvSha256 ?? null,
  failures: [...(verification?.failures ?? []), ...localCheck.failures].filter(unique),
};

printJson(result);
if (result.status !== "ok") process.exit(1);

function parseArgs(args) {
  const parsed = {
    dataDir: DEFAULT_BUILDER_DATA_DIR,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--data-dir") {
      parsed.dataDir = args[++index];
    } else if (arg === "--convex-url") {
      parsed.convexUrl = args[++index];
    } else if (arg === "--import-id") {
      parsed.importId = args[++index];
    } else if (arg === "--mock-result-file") {
      parsed.mockResultFile = args[++index];
    } else if (arg === "--help" || arg === "-h") {
      usage();
    } else {
      usage(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function unique(value, index, values) {
  return values.indexOf(value) === index;
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function usage(error) {
  if (error) console.error(error);
  console.error(`Usage:
  CONVEX_URL=https://... node scripts/verify-builder-detailed-list-convex.mjs [--data-dir data/builders]
  node scripts/verify-builder-detailed-list-convex.mjs --mock-result-file verification.json [--data-dir data/builders]`);
  process.exit(error ? 1 : 0);
}
