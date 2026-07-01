#!/usr/bin/env node
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline/promises";
import path from "node:path";
import {
  DEFAULT_BUILDER_DATA_DIR,
  assertSafeBuilderArtifactFilename,
  buildWebsiteSearchProviderPlan,
  writeWebsiteSearchProviderResults,
} from "../src/backend/index.js";
import { loadLocalEnv } from "./load-local-env.mjs";

await loadLocalEnv();
const options = parseArgs(process.argv.slice(2));
options.inputFilename = assertSafeBuilderArtifactFilename(options.inputFilename, "website search provider input filename");
const searchedAt = options.searchedAt ?? new Date().toISOString();

if (!options.write) {
  const inputPath = path.join(options.dataDir, options.inputFilename);
  const plans = [];
  let scannedRequests = 0;
  let eligibleRequests = 0;

  for await (const request of readNdjson(inputPath)) {
    scannedRequests += 1;
    if (options.state && !request.states?.includes(options.state)) continue;
    const plan = buildWebsiteSearchProviderPlan(request);
    if (!plan.eligible) continue;
    eligibleRequests += 1;
    plans.push(plan);
    if (plans.length >= options.limit) break;
  }

  printJson({
    status: "dry_run_ok",
    searchedAt,
    provider: options.provider,
    scannedRequests,
    eligibleRequests,
    selectedRequests: plans.length,
    plans,
    limitations: [
      "Dry run does not call a search provider and does not create website evidence.",
      "Live mode requires --write plus BRAVE_SEARCH_API_KEY or --api-key.",
    ],
  });
  process.exit(0);
}

if (options.provider !== "brave") {
  throw new Error(`Unsupported website search provider: ${options.provider}`);
}

const apiKey = options.apiKey ?? process.env.BRAVE_SEARCH_API_KEY;
if (!apiKey) {
  throw new Error("Missing BRAVE_SEARCH_API_KEY. Live website search mode requires --write plus a real Brave Search API key.");
}

const result = await writeWebsiteSearchProviderResults({
  ...options,
  apiKey,
  searchedAt,
});

printJson({
  status: "ok",
  outputPath: result.outputPath,
  summaryPath: result.summaryPath,
  ...result.summary,
});

function parseArgs(args) {
  const parsed = {
    dataDir: DEFAULT_BUILDER_DATA_DIR,
    outputDir: DEFAULT_BUILDER_DATA_DIR,
    inputFilename: "builder-website-search-requests.ndjson",
    outputFilename: "builder-website-search-results.ndjson",
    summaryFilename: "builder-website-search-results-summary.json",
    provider: "brave",
    limit: 10,
    maxResults: 10,
    write: false,
    overwrite: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--data-dir") {
      parsed.dataDir = args[++index];
    } else if (arg === "--output-dir") {
      parsed.outputDir = args[++index];
    } else if (arg === "--input-file") {
      parsed.inputFilename = args[++index];
    } else if (arg === "--output-file") {
      parsed.outputFilename = args[++index];
    } else if (arg === "--summary-file") {
      parsed.summaryFilename = args[++index];
    } else if (arg === "--provider") {
      parsed.provider = args[++index];
    } else if (arg === "--state") {
      parsed.state = args[++index]?.toUpperCase();
    } else if (arg === "--limit") {
      parsed.limit = Number(args[++index]);
      if (!Number.isFinite(parsed.limit) || parsed.limit < 1) usage("--limit must be a positive number");
    } else if (arg === "--max-results") {
      parsed.maxResults = Number(args[++index]);
      if (!Number.isFinite(parsed.maxResults) || parsed.maxResults < 1) usage("--max-results must be a positive number");
    } else if (arg === "--api-key") {
      parsed.apiKey = args[++index];
    } else if (arg === "--searched-at") {
      parsed.searchedAt = args[++index];
    } else if (arg === "--write") {
      parsed.write = true;
    } else if (arg === "--overwrite") {
      parsed.overwrite = true;
    } else if (arg === "--help" || arg === "-h") {
      usage();
    } else {
      usage(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

async function* readNdjson(filepath) {
  const rl = createInterface({ input: createReadStream(filepath) });
  for await (const line of rl) {
    if (line.trim()) yield JSON.parse(line);
  }
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function usage(error) {
  if (error) console.error(error);
  console.error(`Usage:
  node scripts/run-builder-website-search-provider.mjs [--state QLD] [--limit 10]
  BRAVE_SEARCH_API_KEY=... node scripts/run-builder-website-search-provider.mjs --write [--state QLD] [--limit 10] [--max-results 10]

Dry run lists provider-ready website search requests. Live mode writes real search-provider result evidence for generate:builders:website-candidates.`);
  process.exit(error ? 1 : 0);
}
