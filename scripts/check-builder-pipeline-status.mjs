#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { DEFAULT_BUILDER_DATA_DIR } from "../src/backend/index.js";
import { loadLocalEnv } from "./load-local-env.mjs";

await loadLocalEnv();
const options = parseArgs(process.argv.slice(2));
const checkedAt = options.checkedAt ?? new Date().toISOString();
const dataDir = options.dataDir;
const readiness = await readOptionalJson(path.join(dataDir, "builder-production-readiness.json"));
const manifest = await readRequiredJson(path.join(dataDir, "manifest.json"));
const artifactStatus = await buildArtifactStatus(dataDir);
const credentialStatus = buildCredentialStatus();
const dryRunStatus = buildDryRunStatus(artifactStatus, credentialStatus);
const reviewQueryStatus = buildReviewQueryStatus(artifactStatus);
const sourceAccessStatus = buildSourceAccessStatus(readiness, artifactStatus);
const convexStatus = options.skipConvex ? { skipped: true } : await buildConvexStatus(options, readiness);
const nextActions = buildNextActions({ readiness, artifactStatus, credentialStatus, convexStatus });
const automation = {
  safeToScheduleEvery15Minutes: true,
  recommendedCommand: "npm run check:builders:pipeline",
  verificationGateCommand: "npm run verify:builders:pipeline",
  writesBuilderEvidence: false,
  notes: [
    "This check is read-only and does not call search, ABN Lookup or website fetch providers.",
    "Use verificationGateCommand for the full read-only local and Convex backend gate.",
    "Credentialed enrichment commands still require explicit --write on their own CLIs.",
  ],
};

printJson({
  status: readiness?.status ?? "unknown",
  checkedAt,
  generatedAt: readiness?.generatedAt ?? null,
  summary: readiness?.summary ?? {
    builders: manifest.totals?.builders ?? 0,
    licences: manifest.totals?.licences ?? 0,
  },
  blockers: (readiness?.blockers ?? []).map((blocker) => ({
    blockerId: blocker.blockerId,
    severity: blocker.severity,
    requiredEvidence: blocker.requiredEvidence,
  })),
  artifacts: artifactStatus,
  credentials: credentialStatus,
  dryRuns: dryRunStatus,
  sourceAccess: sourceAccessStatus,
  reviewQueries: reviewQueryStatus,
  convex: convexStatus,
  nextActions,
  automation,
});

function buildCredentialStatus() {
  return {
    BRAVE_SEARCH_API_KEY: {
      present: Boolean(process.env.BRAVE_SEARCH_API_KEY),
      enables: "Live website search provider evidence via enrich:builders:website-search-provider -- --write.",
    },
    ABN_LOOKUP_GUID: {
      present: Boolean(process.env.ABN_LOOKUP_GUID),
      enables: "Live ABN Lookup identity evidence via enrich:builders:abn-lookup -- --write.",
    },
  };
}

async function buildArtifactStatus(dataDir) {
  const required = [
    "manifest.json",
    "builders.ndjson",
    "builder-licences.ndjson",
    "builder-memory-cards.ndjson",
    "builder-search-index.ndjson",
    "builder-duplicate-review.ndjson",
    "source-access-report.json",
    "source-access-requests.json",
    "builder-detailed-list.ndjson",
    "builder-detailed-list-audit.json",
    "builder-enrichment-jobs.ndjson",
    "builder-website-discovery-jobs.ndjson",
    "builder-website-search-requests.ndjson",
    "builder-production-readiness.json",
  ];
  const optionalEvidence = [
    "builder-website-search-results.ndjson",
    "builder-website-candidates.ndjson",
    "builder-website-corroboration.ndjson",
    "builder-website-update-proposals.ndjson",
    "builder-abn-lookup-results.ndjson",
    "builder-abn-merge-proposals.ndjson",
  ];
  const status = {};
  for (const filename of required) {
    status[filename] = { required: true, present: await fileExists(path.join(dataDir, filename)) };
  }
  for (const filename of optionalEvidence) {
    status[filename] = { required: false, present: await fileExists(path.join(dataDir, filename)) };
  }
  return status;
}

function buildDryRunStatus(artifacts, credentials) {
  return {
    websiteSearchProvider: {
      runnable: artifacts["builder-website-search-requests.ndjson"]?.present === true,
      liveReady: credentials.BRAVE_SEARCH_API_KEY.present,
      command: "npm run enrich:builders:website-search-provider -- --state QLD --limit 10",
      liveCommand: "npm run enrich:builders:website-search-provider -- --write --state QLD --limit 10",
    },
    websiteCorroboration: {
      runnable: artifacts["builder-website-candidates.ndjson"]?.present === true,
      liveReady: artifacts["builder-website-candidates.ndjson"]?.present === true,
      command: "npm run enrich:builders:website-corroboration -- --state QLD --limit 10",
      liveCommand: "npm run enrich:builders:website-corroboration -- --write --state QLD --limit 10",
    },
    websiteUpdateProposals: {
      runnable: artifacts["builder-website-corroboration.ndjson"]?.present === true,
      liveReady: artifacts["builder-website-corroboration.ndjson"]?.present === true,
      command: "npm run generate:builders:website-update-proposals",
      liveCommand: "npm run generate:builders:website-update-proposals",
    },
    abnLookup: {
      runnable: artifacts["builder-enrichment-jobs.ndjson"]?.present === true,
      liveReady: credentials.ABN_LOOKUP_GUID.present,
      command: "npm run enrich:builders:abn-lookup -- --state QLD --limit 10",
      liveCommand: "npm run enrich:builders:abn-lookup -- --write --state QLD --limit 10",
    },
  };
}

function buildSourceAccessStatus(readiness, artifacts) {
  const pendingStates = readiness?.summary?.pendingStates ?? [];
  return {
    pendingStates,
    requestPacket: {
      present: artifacts["source-access-requests.json"]?.present === true,
      command: "npm run generate:builders:source-access-requests -- --write",
      writesBuilderEvidence: false,
    },
    sanctionedExtractValidation: {
      runnable: artifacts["source-access-requests.json"]?.present === true,
      commandTemplate:
        "npm run validate:builders:sanctioned-extract -- --input-file <regulator-extract.csv> --state <SA|TAS> --format csv --permission-reference <written-permission-ref> --permission-file <permission-evidence.txt> --write --fail-on-hard-failures",
      writesBuilderEvidence: false,
      writesValidationReportOnly: true,
      notes: [
        "Use only after receiving a sanctioned current extract/API export or written permission from the regulator.",
        "The validator parses CSV, JSON or NDJSON and records SHA-256 evidence for the supplied extract and permission evidence file when --write is used.",
        "A passing validation does not import builders; it only permits mapper implementation/review work.",
      ],
    },
  };
}

function buildReviewQueryStatus(artifacts) {
  return {
    websiteSearchRequests: {
      runnable: artifacts["builder-website-search-requests.ndjson"]?.present === true,
      command: "npm run query:builders:website-search-requests-convex -- --state QLD --limit 25",
      writesBuilderEvidence: false,
    },
    duplicateReviews: {
      runnable: artifacts["builder-duplicate-review.ndjson"]?.present === true,
      command: "npm run query:builders:duplicate-review-convex -- --limit 25",
      writesBuilderEvidence: false,
    },
    websiteCandidates: {
      runnable: true,
      command: "npm run query:builders:website-review-convex -- --kind candidates --state QLD --limit 25",
      writesBuilderEvidence: false,
    },
    websiteCorroborations: {
      runnable: true,
      command: "npm run query:builders:website-review-convex -- --kind corroborations --status corroborated --limit 25",
      writesBuilderEvidence: false,
    },
    websiteUpdateProposals: {
      runnable: true,
      command: "npm run query:builders:website-review-convex -- --kind proposals --status proposed --limit 25",
      writesBuilderEvidence: false,
    },
    abnLookupResults: {
      runnable: true,
      command: "npm run query:builders:abn-review-convex -- --kind lookup --status checked --limit 25",
      writesBuilderEvidence: false,
    },
    abnMergeProposals: {
      runnable: true,
      command: "npm run query:builders:abn-review-convex -- --kind proposals --status proposed --limit 25",
      writesBuilderEvidence: false,
    },
  };
}

async function buildConvexStatus(options, readiness) {
  if (options.mockConvexQueryFile) {
    const mock = await readRequiredJson(options.mockConvexQueryFile);
    return summarizeConvexStatus(mock, readiness);
  }

  const convexUrl = options.convexUrl ?? process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL;
  if (!convexUrl) {
    return {
      available: false,
      reason: "Missing CONVEX_URL or VITE_CONVEX_URL.",
    };
  }
  const client = new ConvexHttpClient(convexUrl);
  const [
    sourceAccessReport,
    sourceAccessRecheck,
    websiteSearchRequests,
    productionReadiness,
    duplicateReviews,
    websiteCandidates,
    websiteCorroborations,
    websiteUpdateProposals,
    abnLookupResults,
    abnMergeProposals,
  ] = await Promise.all([
    safeConvexQuery(() => client.query(api.builderMemory.getSourceAccessReport, {})),
    safeConvexQuery(() => client.query(api.builderMemory.latestSourceAccessRecheck, {})),
    safeConvexQuery(() => client.query(api.builderMemory.verifyWebsiteSearchRequestRun, {})),
    safeConvexQuery(() => client.query(api.builderMemory.verifyProductionReadinessRun, readiness?.generatedAt ? { importId: `builder-production-readiness:${readiness.generatedAt}` } : {})),
    safeConvexQuery(() => client.query(api.builderMemory.searchDuplicateReviews, { limit: 1 })),
    safeConvexQuery(() => client.query(api.builderMemory.searchWebsiteCandidates, { limit: 1 })),
    safeConvexQuery(() => client.query(api.builderMemory.searchWebsiteCorroborations, { limit: 1 })),
    safeConvexQuery(() => client.query(api.builderMemory.searchWebsiteUpdateProposals, { limit: 1 })),
    safeConvexQuery(() => client.query(api.builderMemory.searchAbnLookupResults, { limit: 1 })),
    safeConvexQuery(() => client.query(api.builderMemory.searchAbnMergeProposals, { limit: 1 })),
  ]);
  return summarizeConvexStatus(
    {
      sourceAccessReport,
      sourceAccessRecheck,
      websiteSearchRequests,
      productionReadiness,
      duplicateReviews,
      websiteCandidates,
      websiteCorroborations,
      websiteUpdateProposals,
      abnLookupResults,
      abnMergeProposals,
    },
    readiness
  );
}

function summarizeConvexStatus(results, readiness) {
  return {
    available: true,
    sourceAccess: summarizeConvexSourceAccess(results.sourceAccessReport, results.sourceAccessRecheck, readiness),
    websiteSearchRequests: summarizeConvexVerification(results.websiteSearchRequests),
    productionReadiness: summarizeConvexVerification(results.productionReadiness),
    reviewQueues: {
      duplicateReviews: summarizeConvexReadQueue(results.duplicateReviews),
      websiteCandidates: summarizeConvexReadQueue(results.websiteCandidates),
      websiteCorroborations: summarizeConvexReadQueue(results.websiteCorroborations),
      websiteUpdateProposals: summarizeConvexReadQueue(results.websiteUpdateProposals),
      abnLookupResults: summarizeConvexReadQueue(results.abnLookupResults),
      abnMergeProposals: summarizeConvexReadQueue(results.abnMergeProposals),
    },
  };
}

function summarizeConvexSourceAccess(report, recheck, readiness) {
  if (report?.ok === false) {
    return {
      status: report.status ?? "unavailable",
      ok: false,
      failures: report.failures ?? [],
    };
  }
  if (!report) {
    return {
      status: "missing",
      ok: false,
      failures: ["Convex source access report is missing."],
    };
  }

  const expectedImportedStates = readiness?.summary?.importedStates ?? [];
  const expectedPendingStates = readiness?.summary?.pendingStates ?? [];
  const failures = [];
  compareStringSet(failures, "Convex source access imported states", report.importedStates ?? [], expectedImportedStates);
  compareStringSet(failures, "Convex source access pending states", report.pendingStates ?? [], expectedPendingStates);
  if (expectedPendingStates.length > 0) {
    if (recheck?.ok === false) {
      failures.push(...(recheck.failures ?? ["Convex source access recheck is unavailable."]));
    } else if (!recheck) {
      failures.push("Convex source access recheck is missing while states remain pending.");
    } else {
      compareStringSet(failures, "Convex source access recheck pending states", recheck.pendingStates ?? [], expectedPendingStates);
      if (!recheck.checkedAt) failures.push("Convex source access recheck is missing checkedAt.");
    }
  }

  const pendingSources = parseJsonArray(report.pendingSourcesJson);
  return {
    status: failures.length ? "mismatch" : "ok",
    ok: failures.length === 0,
    importId: report.importId ?? null,
    generatedAt: report.generatedAt ?? null,
    importedStates: report.importedStates ?? [],
    pendingStates: report.pendingStates ?? [],
    pendingSourceCount: pendingSources.length,
    recheckCheckedAt: recheck?.checkedAt ?? null,
    failures,
  };
}

function summarizeConvexVerification(result) {
  if (!result.ok) {
    return {
      status: result.status ?? "unavailable",
      ok: false,
      failures: result.failures ?? [],
    };
  }
  return {
    status: result.status,
    ok: true,
    importId: result.importId,
    loadedRows: result.loadedRows ?? null,
    readinessStatus: result.readinessStatus ?? null,
  };
}

function summarizeConvexReadQueue(result) {
  if (result.ok === false) {
    return {
      status: result.status ?? "unavailable",
      ok: false,
      failures: result.failures ?? [],
    };
  }
  return {
    status: "ok",
    ok: true,
    sampleCount: result.count ?? 0,
    limitations: result.limitations ?? [],
  };
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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

async function safeConvexQuery(operation) {
  try {
    return await operation();
  } catch (error) {
    return {
      status: "unavailable",
      ok: false,
      failures: [error instanceof Error ? error.message : String(error)],
    };
  }
}

function buildNextActions({ readiness, artifactStatus, credentialStatus, convexStatus }) {
  const actions = [];
  if ((readiness?.summary?.pendingStates ?? []).length) {
    actions.push({
      priority: "high",
      action: "Resolve pending SA/TAS sanctioned source access.",
      command: "npm run generate:builders:source-access-requests -- --write && npm run recheck:builders:sources -- --write --push-convex",
      blockedBy: "Public SA/TAS registers remain protected; use sanctioned bulk extract, API or permission.",
    });
    actions.push({
      priority: "high",
      action: "Validate any received sanctioned SA/TAS extract before mapper or import work.",
      command:
        "npm run validate:builders:sanctioned-extract -- --input-file <regulator-extract.csv> --state <SA|TAS> --format csv --permission-reference <written-permission-ref> --permission-file <permission-evidence.txt> --write --fail-on-hard-failures",
      blockedBy: "Requires a real regulator extract and written permission reference.",
    });
  }
  if (!credentialStatus.BRAVE_SEARCH_API_KEY.present) {
    actions.push({
      priority: "high",
      action: "Add a real Brave Search API key before live website search evidence.",
      command: "BRAVE_SEARCH_API_KEY=... npm run enrich:builders:website-search-provider -- --write --state QLD --limit 10",
      blockedBy: "Missing BRAVE_SEARCH_API_KEY.",
    });
  } else if (!artifactStatus["builder-website-search-results.ndjson"]?.present) {
    actions.push({
      priority: "high",
      action: "Run live website search provider evidence.",
      command: "npm run enrich:builders:website-search-provider -- --write --state QLD --limit 10",
    });
  }
  if (artifactStatus["builder-website-search-results.ndjson"]?.present && !artifactStatus["builder-website-candidates.ndjson"]?.present) {
    actions.push({
      priority: "high",
      action: "Generate review-only website candidates from real search evidence.",
      command: "npm run generate:builders:website-candidates -- --input-file builder-website-search-results.ndjson",
    });
  }
  if (artifactStatus["builder-website-candidates.ndjson"]?.present && !artifactStatus["builder-website-corroboration.ndjson"]?.present) {
    actions.push({
      priority: "high",
      action: "Fetch and score website candidate corroboration evidence.",
      command: "npm run enrich:builders:website-corroboration -- --write --state QLD --limit 10",
    });
  }
  if (artifactStatus["builder-website-corroboration.ndjson"]?.present && !artifactStatus["builder-website-update-proposals.ndjson"]?.present) {
    actions.push({
      priority: "high",
      action: "Generate review-only website update proposals from corroboration evidence.",
      command: "npm run generate:builders:website-update-proposals",
    });
  }
  if (!credentialStatus.ABN_LOOKUP_GUID.present) {
    actions.push({
      priority: "high",
      action: "Add a real ABN Lookup GUID before live ABN evidence.",
      command: "ABN_LOOKUP_GUID=... npm run enrich:builders:abn-lookup -- --write --state QLD --limit 10",
      blockedBy: "Missing ABN_LOOKUP_GUID.",
    });
  }
  if (convexStatus.available === false || convexStatus.productionReadiness?.ok === false) {
    actions.push({
      priority: "medium",
      action: "Verify Convex production-readiness import.",
      command: "npm run import:builders:production-readiness-convex && npm run verify:builders:production-readiness-convex",
    });
  }
  if (convexStatus.sourceAccess?.ok === false) {
    actions.push({
      priority: "medium",
      action: "Verify Convex source-access import.",
      command: "npm run import:builders:source-access-convex && npm run verify:builders:source-access-convex",
    });
  }
  return actions;
}

function parseArgs(args) {
  const parsed = {
    dataDir: DEFAULT_BUILDER_DATA_DIR,
    skipConvex: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--data-dir") parsed.dataDir = args[++index];
    else if (arg === "--convex-url") parsed.convexUrl = args[++index];
    else if (arg === "--checked-at") parsed.checkedAt = args[++index];
    else if (arg === "--mock-convex-query-file") parsed.mockConvexQueryFile = args[++index];
    else if (arg === "--skip-convex") parsed.skipConvex = true;
    else if (arg === "--help" || arg === "-h") usage();
    else usage(`Unknown argument: ${arg}`);
  }
  return parsed;
}

async function readRequiredJson(filepath) {
  return JSON.parse(await readFile(filepath, "utf8"));
}

async function readOptionalJson(filepath) {
  try {
    return await readRequiredJson(filepath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function fileExists(filepath) {
  try {
    await access(filepath);
    return true;
  } catch {
    return false;
  }
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function usage(error) {
  if (error) console.error(error);
  console.error(`Usage:
  node scripts/check-builder-pipeline-status.mjs [--data-dir data/builders] [--skip-convex]
  node scripts/check-builder-pipeline-status.mjs --mock-convex-query-file convex-query-results.json [--data-dir data/builders]

Read-only backend pipeline status check. It does not call external enrichment providers and does not write builder evidence.`);
  process.exit(error ? 1 : 0);
}
