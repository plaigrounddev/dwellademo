#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { DEFAULT_BUILDER_DATA_DIR, readBuilderConvexImportMetadata } from "../src/backend/index.js";
import { loadLocalEnv } from "./load-local-env.mjs";

await loadLocalEnv();
const options = parseArgs(process.argv.slice(2));
const metadata = await readBuilderConvexImportMetadata(options.dataDir);
const [manifest, localReport, localRecheck] = await Promise.all([
  readJson(path.join(options.dataDir, "manifest.json")),
  readJson(path.join(options.dataDir, "source-access-report.json")),
  readOptionalJson(path.join(options.dataDir, "source-access-recheck.json")),
]);
let convexReport;
let convexRecheck;

if (options.mockReportFile) {
  convexReport = JSON.parse(await readFile(options.mockReportFile, "utf8"));
}
if (options.mockRecheckFile) {
  convexRecheck = JSON.parse(await readFile(options.mockRecheckFile, "utf8"));
}

if (!convexReport || (!convexRecheck && (manifest.pendingStates?.length ?? 0) > 0)) {
  const convexUrl = options.convexUrl ?? process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL;
  if (!convexUrl) throw new Error("Missing Convex URL. Set CONVEX_URL or VITE_CONVEX_URL, or pass mock files.");
  const client = new ConvexHttpClient(convexUrl);
  try {
    if (!convexReport) {
      convexReport = await client.query(api.builderMemory.getSourceAccessReport, { importId: options.importId ?? metadata.importId });
    }
    if (!convexRecheck && (manifest.pendingStates?.length ?? 0) > 0) {
      convexRecheck = await client.query(api.builderMemory.latestSourceAccessRecheck, { importId: options.importId ?? metadata.importId });
    }
  } catch (error) {
    printJson({
      status: "unavailable",
      importId: options.importId ?? metadata.importId,
      failures: [
        `Convex source access query failed: ${error instanceof Error ? error.message : String(error)}`,
        "Deploy the Convex builderMemory functions before verifying live source-access metadata.",
      ],
    });
    process.exit(1);
  }
}

const failures = [];
if (!convexReport) {
  failures.push("Convex source access report is missing.");
}
if ((manifest.pendingStates?.length ?? 0) > 0 && !convexRecheck) {
  failures.push("Convex source access recheck is missing while states remain pending.");
}

const importedSources = parseStoredJson(convexReport?.importedSourcesJson, "Convex source access importedSourcesJson", failures) ?? [];
const pendingSources = parseStoredJson(convexReport?.pendingSourcesJson, "Convex source access pendingSourcesJson", failures) ?? [];
const rejectedCandidates = parseStoredJson(convexReport?.rejectedCandidatesJson, "Convex source access rejectedCandidatesJson", failures) ?? [];
const recheckResults = parseStoredJson(convexRecheck?.resultsJson, "Convex source access recheck resultsJson", failures) ?? [];

if (convexReport) {
  compareValue(failures, "source access importId", convexReport.importId, options.importId ?? metadata.importId);
  compareValue(failures, "source access generatedAt", convexReport.generatedAt, localReport.generatedAt);
  compareStringSet(failures, "source access imported states", convexReport.importedStates, manifest.importedStates);
  compareStringSet(failures, "source access pending states", convexReport.pendingStates, manifest.pendingStates);
  compareNumber(failures, "source access imported source count", importedSources.length, localReport.importedSources?.length ?? 0);
  compareNumber(failures, "source access pending source count", pendingSources.length, localReport.pendingSources?.length ?? 0);
  compareNumber(failures, "source access rejected candidate count", rejectedCandidates.length, localReport.rejectedCandidates?.length ?? 0);
  compareStringSet(failures, "source access limitations", convexReport.limitations ?? [], localReport.limitations ?? []);
  compareSourceIds(failures, "imported source IDs", importedSources, localReport.importedSources ?? []);
  compareSourceIds(failures, "pending source IDs", pendingSources, localReport.pendingSources ?? []);
}

if (convexRecheck) {
  compareValue(failures, "source access recheck importId", convexRecheck.importId, options.importId ?? metadata.importId);
  compareStringSet(failures, "source access recheck pending states", convexRecheck.pendingStates, manifest.pendingStates);
  if (localRecheck) {
    compareValue(failures, "source access recheck checkedAt", convexRecheck.checkedAt, localRecheck.checkedAt);
    compareNumber(failures, "source access recheck result count", recheckResults.length, localRecheck.results?.length ?? 0);
    compareStringSet(failures, "source access recheck limitations", convexRecheck.limitations ?? [], localRecheck.limitations ?? []);
    compareSourceIds(failures, "source access recheck result source IDs", recheckResults, localRecheck.results ?? []);
  }
  for (const result of recheckResults) {
    if (!manifest.pendingStates?.includes(result.state)) {
      failures.push(`source access recheck ${result.sourceId ?? "unknown"}: state is not pending in manifest.`);
    }
    if (result.importDecision !== "not_imported") {
      failures.push(`source access recheck ${result.sourceId ?? "unknown"}: importDecision must remain not_imported until a sanctioned source is implemented.`);
    }
  }
}

const result = {
  status: failures.length ? "mismatch" : "ok",
  importId: options.importId ?? metadata.importId,
  generatedAt: convexReport?.generatedAt ?? null,
  recheckCheckedAt: convexRecheck?.checkedAt ?? null,
  importedStates: convexReport?.importedStates ?? [],
  pendingStates: convexReport?.pendingStates ?? [],
  importedSourceCount: importedSources.length,
  pendingSourceCount: pendingSources.length,
  rejectedCandidateCount: rejectedCandidates.length,
  recheckResultCount: recheckResults.length,
  limitations: uniqueStrings([...(convexReport?.limitations ?? []), ...(convexRecheck?.limitations ?? [])]),
  writesBuilderEvidence: false,
  runsExternalEnrichmentProviders: false,
  failures,
};

printJson(result);
if (result.status !== "ok") process.exit(1);

async function readJson(filepath) {
  return JSON.parse(await readFile(filepath, "utf8"));
}

async function readOptionalJson(filepath) {
  try {
    return await readJson(filepath);
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
}

function parseStoredJson(value, label, failures) {
  if (value == null) return null;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      failures.push(`${label} must be a JSON array.`);
      return [];
    }
    return parsed;
  } catch (error) {
    failures.push(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

function compareValue(failures, label, actual, expected) {
  if (actual !== expected) failures.push(`${label} ${actual ?? "missing"} but expected ${expected ?? "missing"}.`);
}

function compareNumber(failures, label, actual, expected) {
  if (actual !== expected) failures.push(`${label} ${actual} but expected ${expected}.`);
}

function compareStringSet(failures, label, actual, expected) {
  const actualSet = new Set(actual ?? []);
  const expectedSet = new Set(expected ?? []);
  for (const value of expectedSet) {
    if (!actualSet.has(value)) failures.push(`${label} missing ${value}.`);
  }
  for (const value of actualSet) {
    if (!expectedSet.has(value)) failures.push(`${label} has unexpected ${value}.`);
  }
}

function compareSourceIds(failures, label, actual, expected) {
  compareStringSet(
    failures,
    label,
    actual.map((item) => item.sourceId).filter(Boolean),
    expected.map((item) => item.sourceId).filter(Boolean)
  );
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()))];
}

function parseArgs(args) {
  const parsed = {
    dataDir: DEFAULT_BUILDER_DATA_DIR,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--data-dir") parsed.dataDir = args[++index];
    else if (arg === "--convex-url") parsed.convexUrl = args[++index];
    else if (arg === "--import-id") parsed.importId = args[++index];
    else if (arg === "--mock-report-file") parsed.mockReportFile = args[++index];
    else if (arg === "--mock-recheck-file") parsed.mockRecheckFile = args[++index];
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
  CONVEX_URL=https://... node scripts/verify-builder-source-access-convex.mjs [--data-dir data/builders]
  node scripts/verify-builder-source-access-convex.mjs --mock-report-file report.json --mock-recheck-file recheck.json [--data-dir data/builders]`);
  process.exit(error ? 1 : 0);
}
