#!/usr/bin/env node
import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import path from "node:path";
import {
  DEFAULT_BUILDER_DATA_DIR,
  assertSafeBuilderArtifactFilename,
  buildWebsiteCorroborationPlan,
  writeWebsiteCorroborationEvidence,
} from "../src/backend/index.js";

const options = parseArgs(process.argv.slice(2));
options.inputFilename = assertSafeBuilderArtifactFilename(options.inputFilename, "website corroboration input filename");
const fetchedAt = options.fetchedAt ?? new Date().toISOString();

if (!options.write) {
  const inputPath = path.join(options.dataDir, options.inputFilename);
  const inputExists = await fileExists(inputPath);
  if (!inputExists) {
    printJson({
      status: "unavailable",
      fetchedAt,
      inputFile: options.inputFilename,
      scannedCandidates: 0,
      eligibleCandidates: 0,
      selectedCandidates: 0,
      plans: [],
      limitations: [
        "No website candidate artifact exists yet, so there are no candidate URLs to corroborate.",
        "Run the website search provider and candidate generation steps with real evidence before corroboration.",
      ],
    });
    process.exit(0);
  }
  const plans = [];
  let scannedCandidates = 0;
  let eligibleCandidates = 0;

  for await (const candidate of readNdjson(inputPath)) {
    scannedCandidates += 1;
    if (options.state && !candidate.states?.includes(options.state)) continue;
    const plan = buildWebsiteCorroborationPlan(candidate);
    if (!plan.eligible) continue;
    eligibleCandidates += 1;
    plans.push(plan);
    if (plans.length >= options.limit) break;
  }

  printJson({
    status: "dry_run_ok",
    fetchedAt,
    scannedCandidates,
    eligibleCandidates,
    selectedCandidates: plans.length,
    plans,
    limitations: [
      "Dry run does not fetch candidate websites and does not create corroboration evidence.",
      "Live mode requires --write and only writes review-only fetched-page evidence.",
    ],
  });
  process.exit(0);
}

const liveInputPath = path.join(options.dataDir, options.inputFilename);
if (!(await fileExists(liveInputPath))) {
  throw new Error(`Missing ${options.inputFilename}. Run website candidate generation from real search-provider evidence before live corroboration.`);
}

const result = await writeWebsiteCorroborationEvidence({
  ...options,
  fetchedAt,
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
    inputFilename: "builder-website-candidates.ndjson",
    outputFilename: "builder-website-corroboration.ndjson",
    summaryFilename: "builder-website-corroboration-summary.json",
    limit: 10,
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
    } else if (arg === "--state") {
      parsed.state = args[++index]?.toUpperCase();
    } else if (arg === "--limit") {
      parsed.limit = Number(args[++index]);
      if (!Number.isFinite(parsed.limit) || parsed.limit < 1) usage("--limit must be a positive number");
    } else if (arg === "--fetched-at") {
      parsed.fetchedAt = args[++index];
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
  node scripts/run-builder-website-corroboration.mjs [--state QLD] [--limit 10]
  node scripts/run-builder-website-corroboration.mjs --write [--state QLD] [--limit 10]

Dry run lists website candidates eligible for fetched-page corroboration. Live mode fetches candidate URLs and writes review-only corroboration evidence.`);
  process.exit(error ? 1 : 0);
}
