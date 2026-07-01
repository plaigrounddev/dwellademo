#!/usr/bin/env node
import { access } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_BUILDER_DATA_DIR, assertSafeBuilderArtifactFilename, writeWebsiteUpdateProposals } from "../src/backend/index.js";

const options = parseArgs(process.argv.slice(2));
options.inputFilename = assertSafeBuilderArtifactFilename(options.inputFilename, "website update proposal input filename");
const inputPath = path.join(options.dataDir, options.inputFilename);

if (!(await fileExists(inputPath))) {
  throw new Error(`Missing ${options.inputFilename}. Run website corroboration from real candidate evidence before generating website update proposals.`);
}

const result = await writeWebsiteUpdateProposals(options);

console.log(
  JSON.stringify(
    {
      status: "ok",
      outputPath: result.outputPath,
      summaryPath: result.summaryPath,
      ...result.summary,
    },
    null,
    2
  )
);

function parseArgs(args) {
  const parsed = {
    dataDir: DEFAULT_BUILDER_DATA_DIR,
    outputDir: DEFAULT_BUILDER_DATA_DIR,
    inputFilename: "builder-website-corroboration.ndjson",
    outputFilename: "builder-website-update-proposals.ndjson",
    summaryFilename: "builder-website-update-proposals-summary.json",
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
    } else if (arg === "--generated-at") {
      parsed.generatedAt = args[++index];
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

async function fileExists(filepath) {
  try {
    await access(filepath);
    return true;
  } catch {
    return false;
  }
}

function usage(error) {
  if (error) console.error(error);
  console.error(`Usage:
  node scripts/generate-builder-website-update-proposals.mjs [--data-dir data/builders] [--input-file builder-website-corroboration.ndjson] [--overwrite]

Creates review-only builder websiteUrl update proposals from fetched-page website corroboration evidence.`);
  process.exit(error ? 1 : 0);
}
