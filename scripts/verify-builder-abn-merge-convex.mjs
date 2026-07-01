#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { DEFAULT_BUILDER_DATA_DIR, readBuilderAbnMergeConvexImportMetadata, verifyConvexAbnEvidenceRun } from "../src/backend/index.js";
import { loadLocalEnv } from "./load-local-env.mjs";

await loadLocalEnv();
const options = parseArgs(process.argv.slice(2));
const metadata = await readBuilderAbnMergeConvexImportMetadata(options.dataDir);
const verification = options.mockResultFile
  ? JSON.parse(await readFile(options.mockResultFile, "utf8"))
  : await new ConvexHttpClient(options.convexUrl ?? process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL).query(api.builderMemory.verifyAbnMergeRun, { importId: options.importId ?? metadata.importId });
const localCheck = verifyConvexAbnEvidenceRun(metadata.expectedRows, verification, "ABN merge proposal");
const result = { status: localCheck.ok && verification?.ok ? "ok" : "mismatch", importId: verification?.importId ?? metadata.importId, expectedRows: metadata.expectedRows, loadedRows: verification?.loadedRows ?? null, totals: verification?.totals ?? null, failures: [...(verification?.failures ?? []), ...localCheck.failures] };
console.log(JSON.stringify(result, null, 2));
if (result.status !== "ok") process.exit(1);

function parseArgs(args) {
  const parsed = { dataDir: DEFAULT_BUILDER_DATA_DIR };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--data-dir") parsed.dataDir = args[++i];
    else if (arg === "--convex-url") parsed.convexUrl = args[++i];
    else if (arg === "--import-id") parsed.importId = args[++i];
    else if (arg === "--mock-result-file") parsed.mockResultFile = args[++i];
  }
  if (!parsed.mockResultFile && !(parsed.convexUrl ?? process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL)) throw new Error("Missing Convex URL.");
  return parsed;
}
