#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import {
  DEFAULT_BUILDER_DATA_DIR,
  readBuilderWebsiteSearchRequestConvexImportMetadata,
  verifyConvexWebsiteSearchRequestRun,
} from "../src/backend/index.js";
import { loadLocalEnv } from "./load-local-env.mjs";

await loadLocalEnv();
const options = parseArgs(process.argv.slice(2));
const metadata = await readBuilderWebsiteSearchRequestConvexImportMetadata(options.dataDir);
let verification;
let sample;

if (options.mockResultFile) {
  verification = JSON.parse(await readFile(options.mockResultFile, "utf8"));
}
if (options.mockSampleFile) {
  sample = JSON.parse(await readFile(options.mockSampleFile, "utf8"));
}
if (!verification || !sample) {
  const convexUrl = options.convexUrl ?? process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL;
  if (!convexUrl) throw new Error("Missing Convex URL. Set CONVEX_URL or VITE_CONVEX_URL, or pass --mock-result-file for local verification tests.");
  const client = new ConvexHttpClient(convexUrl);
  try {
    if (!verification) {
    verification = await client.query(api.builderMemory.verifyWebsiteSearchRequestRun, { importId: options.importId ?? metadata.importId });
    }
    if (!sample) {
      sample = await client.query(api.builderMemory.searchWebsiteSearchRequests, {
        state: options.state,
        requestStatus: options.requestStatus,
        limit: options.sampleLimit,
      });
    }
  } catch (error) {
    printJson({
      status: "unavailable",
      importId: options.importId ?? metadata.importId,
      expectedRows: metadata.expectedRows,
      failures: [
        `Convex website search request verification query failed: ${error instanceof Error ? error.message : String(error)}`,
        "Deploy the Convex builderMemory functions before verifying a live website search request import.",
      ],
    });
    process.exit(1);
  }
}

const localCheck = verifyConvexWebsiteSearchRequestRun(metadata.expectedRows, verification);
const sampleFailures = inspectSearchRequestSample(sample, metadata.expectedRows);
const result = {
  status: localCheck.ok && verification?.ok && sampleFailures.length === 0 ? "ok" : "mismatch",
  importId: verification?.importId ?? options.importId ?? metadata.importId,
  generatedAt: verification?.generatedAt ?? metadata.websiteSearchRequestRun.generatedAt,
  sourceManifestGeneratedAt: verification?.sourceManifestGeneratedAt ?? metadata.websiteSearchRequestRun.sourceManifestGeneratedAt,
  expectedRows: metadata.expectedRows,
  loadedRows: verification?.loadedRows ?? null,
  totals: verification?.totals ?? null,
  byState: verification?.byState ?? null,
  requestsSha256: verification?.requestsSha256 ?? null,
  sample: {
    count: sample?.count ?? 0,
    state: options.state ?? null,
    requestStatus: options.requestStatus ?? "pending_search_provider",
    limit: options.sampleLimit,
  },
  failures: [...(verification?.failures ?? []), ...localCheck.failures, ...sampleFailures].filter(unique),
};

printJson(result);
if (result.status !== "ok") process.exit(1);

function parseArgs(args) {
  const parsed = { dataDir: DEFAULT_BUILDER_DATA_DIR, sampleLimit: 10 };
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
    } else if (arg === "--mock-sample-file") {
      parsed.mockSampleFile = args[++index];
    } else if (arg === "--state") {
      parsed.state = args[++index];
    } else if (arg === "--request-status") {
      parsed.requestStatus = args[++index];
    } else if (arg === "--sample-limit") {
      parsed.sampleLimit = Number(args[++index]);
      if (!Number.isFinite(parsed.sampleLimit) || parsed.sampleLimit < 1) usage("--sample-limit must be a positive number");
    } else if (arg === "--help" || arg === "-h") {
      usage();
    } else {
      usage(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

function inspectSearchRequestSample(sample, expectedRows) {
  const failures = [];
  const rows = sample?.results ?? [];
  if (expectedRows > 0 && rows.length === 0) failures.push("Convex website search request sample returned no rows.");
  for (const [index, row] of rows.entries()) {
    const label = `website search request sample ${index + 1}`;
    if (!row.requestId) failures.push(`${label}: missing requestId.`);
    if (!row.discoveryJobId) failures.push(`${label}: missing discoveryJobId.`);
    if (!row.builderId) failures.push(`${label}: missing builderId.`);
    if (!row.builderName) failures.push(`${label}: missing builderName.`);
    if (!row.query) failures.push(`${label}: missing query.`);
    if (row.requestStatus !== "pending_search_provider") failures.push(`${label}: requestStatus must remain pending_search_provider.`);
    if ("url" in row || "host" in row || "title" in row || "snippet" in row) failures.push(`${label}: must not contain search-result fields.`);
    if ("reviewOnly" in row || "autoApply" in row) failures.push(`${label}: must not contain apply/review flags.`);
    if (!Array.isArray(row.constraints) || !row.constraints.some((constraint) => constraint.includes("Do not infer a website URL"))) {
      failures.push(`${label}: missing no-inference website constraint.`);
    }
  }
  return failures;
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
  CONVEX_URL=https://... node scripts/verify-builder-website-search-requests-convex.mjs [--data-dir data/builders] [--sample-limit 10]
  node scripts/verify-builder-website-search-requests-convex.mjs --mock-result-file verification.json --mock-sample-file sample.json [--data-dir data/builders]`);
  process.exit(error ? 1 : 0);
}
