#!/usr/bin/env node
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_BUILDER_DATA_DIR,
  assertSafeBuilderArtifactFilename,
  buildBuilderSourceAccessRequests,
  listBuilderDataSources,
} from "../src/backend/index.js";

const options = parseArgs(process.argv.slice(2));
options.outputFile = assertSafeBuilderArtifactFilename(options.outputFile, "source access requests output filename");
const manifestPath = path.join(options.dataDir, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const sourceAccessReport = JSON.parse(await readFile(path.join(options.dataDir, "source-access-report.json"), "utf8"));
const generatedAt = options.generatedAt ?? new Date().toISOString();
const report = buildBuilderSourceAccessRequests({
  sources: listBuilderDataSources(),
  manifest,
  sourceAccessReport,
  generatedAt,
});

if (options.write) {
  await mkdir(options.dataDir, { recursive: true });
  await writeJson(path.join(options.dataDir, options.outputFile), report);
  manifest.files ??= {};
  const filepath = path.join(options.dataDir, options.outputFile);
  const fileStat = await stat(filepath);
  manifest.files[options.outputFile] = {
    format: "json",
    rowCount: report.requests.length,
    bytes: fileStat.size,
    sha256: await sha256File(filepath),
  };
  await writeJson(manifestPath, manifest);
}

printJson({
  status: options.write ? "written" : "dry_run_ok",
  outputFile: options.outputFile,
  generatedAt: report.generatedAt,
  pendingStates: report.pendingStates,
  requests: report.requests.map((request) => ({
    state: request.state,
    sourceId: request.sourceId,
    requestStatus: request.requestStatus,
    email: request.contact.email,
  })),
});

function parseArgs(args) {
  const parsed = {
    dataDir: DEFAULT_BUILDER_DATA_DIR,
    outputFile: "source-access-requests.json",
    write: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--data-dir") parsed.dataDir = args[++index];
    else if (arg === "--generated-at") parsed.generatedAt = args[++index];
    else if (arg === "--output-file") parsed.outputFile = args[++index];
    else if (arg === "--write") parsed.write = true;
    else if (arg === "--help" || arg === "-h") usage();
    else usage(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

async function writeJson(filepath, value) {
  await writeFile(filepath, `${JSON.stringify(value, null, 2)}\n`);
}

async function sha256File(filepath) {
  const hash = createHash("sha256");
  await new Promise((resolve, reject) => {
    createReadStream(filepath)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", resolve);
  });
  return hash.digest("hex");
}

function usage(error) {
  if (error) console.error(error);
  console.error(`Usage:
  node scripts/generate-builder-source-access-requests.mjs [--write] [--data-dir data/builders] [--generated-at ISO_DATE]`);
  process.exit(error ? 1 : 0);
}
