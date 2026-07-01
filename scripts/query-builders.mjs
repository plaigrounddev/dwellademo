#!/usr/bin/env node
import {
  DEFAULT_BUILDER_DATA_DIR,
  getBuilderArtifactEvidence,
  getBuilderCoverageStatus,
  getBuilderEnrichmentPlan,
  readBuilderArtifactManifest,
  searchBuilderArtifacts,
  searchBuilderDuplicateReviewArtifacts,
} from "../src/backend/index.js";

const options = parseArgs(process.argv.slice(2));

if (options.command === "manifest") {
  const manifest = await readBuilderArtifactManifest(options.dataDir);
  printJson({
    generatedAt: manifest.generatedAt,
    totals: manifest.totals,
    importedStates: manifest.importedStates,
    pendingStates: manifest.pendingStates,
    verifiedFiles: Object.keys(manifest.files ?? {}).length,
    limitations: manifest.manifest?.limitations ?? [],
  });
} else if (options.command === "coverage") {
  printJson(await getBuilderCoverageStatus(options.dataDir));
} else if (options.command === "enrichment-plan") {
  printJson(
    await getBuilderEnrichmentPlan({
      dataDir: options.dataDir,
      state: options.state,
      gap: options.gap,
      limit: options.limit,
    })
  );
} else if (options.command === "search") {
  const results = await searchBuilderArtifacts(
    {
      state: options.state,
      postcode: options.postcode,
      licenceClass: options.licenceClass,
      source: options.source,
      query: options.query,
      mustHaves: options.mustHaves,
    },
    {
      dataDir: options.dataDir,
      limit: options.limit,
      minScore: options.minScore,
    }
  );
  printJson({
    count: results.length,
    results,
    limitations: [
      "Search results are official licence evidence, not a guarantee of suitability, availability, insurance or quality.",
      "Unknown website, pricing, capacity and quote behaviour fields remain unknown until evidence-backed enrichment runs.",
    ],
  });
} else if (options.command === "evidence") {
  if (!options.builderId) {
    throw new Error("Missing --builder-id for evidence command");
  }
  printJson(await getBuilderArtifactEvidence(options.builderId, { dataDir: options.dataDir }));
} else if (options.command === "duplicates") {
  const results = await searchBuilderDuplicateReviewArtifacts(
    {
      state: options.state,
      query: options.query,
      reviewReason: options.reviewReason,
      confidence: options.confidence,
    },
    {
      dataDir: options.dataDir,
      limit: options.limit,
      minBuilderCount: options.minBuilderCount,
    }
  );
  printJson({
    count: results.length,
    results,
    limitations: [
      "Duplicate-review rows are same-name review candidates only.",
      "They are not automatic merges and are not proof that records belong to the same business.",
    ],
  });
} else {
  usage(`Unknown command: ${options.command}`);
}

function parseArgs(args) {
  const options = {
    command: args[0] ?? "help",
    dataDir: DEFAULT_BUILDER_DATA_DIR,
    limit: 25,
    minScore: 1,
    mustHaves: [],
  };

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--data-dir") {
      options.dataDir = args[++index];
    } else if (arg === "--state") {
      options.state = args[++index];
    } else if (arg === "--postcode") {
      options.postcode = args[++index];
    } else if (arg === "--licence-class") {
      options.licenceClass = args[++index];
    } else if (arg === "--source") {
      options.source = args[++index];
    } else if (arg === "--gap") {
      options.gap = args[++index];
    } else if (arg === "--query") {
      options.query = args[++index];
    } else if (arg === "--must-have") {
      options.mustHaves.push(args[++index]);
    } else if (arg === "--builder-id") {
      options.builderId = args[++index];
    } else if (arg === "--review-reason") {
      options.reviewReason = args[++index];
    } else if (arg === "--confidence") {
      options.confidence = args[++index];
    } else if (arg === "--min-builder-count") {
      options.minBuilderCount = Number(args[++index]);
      if (!Number.isFinite(options.minBuilderCount) || options.minBuilderCount < 2) usage("--min-builder-count must be at least 2");
    } else if (arg === "--limit") {
      options.limit = Number(args[++index]);
      if (!Number.isFinite(options.limit) || options.limit < 1) usage("--limit must be a positive number");
    } else if (arg === "--min-score") {
      options.minScore = Number(args[++index]);
      if (!Number.isFinite(options.minScore) || options.minScore < 0) usage("--min-score must be zero or a positive number");
    } else if (arg === "--help" || arg === "-h") {
      usage();
    } else {
      usage(`Unknown argument: ${arg}`);
    }
  }

  if (options.command === "help" || options.command === "--help" || options.command === "-h") usage();
  return options;
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function usage(error) {
  if (error) console.error(error);
  console.error(`Usage:
  node scripts/query-builders.mjs manifest [--data-dir data/builders]
  node scripts/query-builders.mjs coverage [--data-dir data/builders]
  node scripts/query-builders.mjs enrichment-plan [--state QLD] [--gap business_identity|website_discovery|website_enrichment|service_region|address] [--limit 25]
  node scripts/query-builders.mjs search [--state QLD] [--postcode 4000] [--licence-class "Builder - Low Rise"] [--source QBCC] [--query "name or term"] [--must-have term] [--limit 25]
  node scripts/query-builders.mjs duplicates [--state QLD] [--query "name"] [--review-reason same_normalized_name_across_states] [--confidence name_only_review_candidate] [--min-builder-count 2] [--limit 25]
  node scripts/query-builders.mjs evidence --builder-id builder:... [--data-dir data/builders]`);
  process.exit(error ? 1 : 0);
}
