#!/usr/bin/env node
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_BUILDER_DATA_DIR, assertSafeBuilderArtifactFilename, validateSanctionedBuilderExtractFile } from "../src/backend/index.js";

const options = parseArgs(process.argv.slice(2));
const manifest = JSON.parse(await readFile(path.join(options.dataDir, "manifest.json"), "utf8"));
const sourceAccessRequests = JSON.parse(await readFile(path.join(options.dataDir, "source-access-requests.json"), "utf8"));
const permissionEvidence = options.permissionReference || options.permissionFile
  ? { reference: options.permissionReference ?? null, filepath: options.permissionFile ?? null }
  : null;
const validation = await validateSanctionedBuilderExtractFile({
  filepath: options.inputFile,
  format: options.format,
  sourceId: options.sourceId,
  state: options.state,
  manifest,
  sourceAccessRequests,
  permissionEvidence,
  generatedAt: options.generatedAt ?? new Date().toISOString(),
});
const outputFile = assertSafeBuilderArtifactFilename(options.outputFile ?? buildDefaultOutputFile(validation), "sanctioned extract output filename");

if (options.write) {
  await mkdir(options.dataDir, { recursive: true });
  const outputPath = path.join(options.dataDir, outputFile);
  await writeFile(outputPath, `${JSON.stringify(validation, null, 2)}\n`);
  await updateManifestFileMetadata({
    manifest,
    manifestPath: path.join(options.dataDir, "manifest.json"),
    filepath: outputPath,
    filename: outputFile,
    rowCount: 1,
  });
}

console.log(JSON.stringify({
  status: validation.importDecision,
  outputFile: options.write ? outputFile : null,
  sourceId: validation.sourceId,
  state: validation.state,
  inputFileSha256: validation.inputFile?.sha256 ?? null,
  permissionEvidenceFileSha256: validation.permissionEvidence?.file?.sha256 ?? null,
  rows: validation.rowStats.rows,
  builderClassRows: validation.rowStats.builderClassRows,
  hardFailures: validation.hardFailures,
}, null, 2));

if (options.failOnHardFailures && validation.hardFailures.length) process.exit(1);

function parseArgs(args) {
  const parsed = {
    dataDir: DEFAULT_BUILDER_DATA_DIR,
    outputFile: null,
    write: false,
    failOnHardFailures: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--data-dir") parsed.dataDir = args[++index];
    else if (arg === "--input-file") parsed.inputFile = args[++index];
    else if (arg === "--output-file") parsed.outputFile = args[++index];
    else if (arg === "--format") parsed.format = args[++index];
    else if (arg === "--state") parsed.state = args[++index]?.toUpperCase();
    else if (arg === "--source-id") parsed.sourceId = args[++index];
    else if (arg === "--permission-reference") parsed.permissionReference = args[++index];
    else if (arg === "--permission-file") parsed.permissionFile = args[++index];
    else if (arg === "--generated-at") parsed.generatedAt = args[++index];
    else if (arg === "--write") parsed.write = true;
    else if (arg === "--fail-on-hard-failures") parsed.failOnHardFailures = true;
    else if (arg === "--help" || arg === "-h") usage();
    else usage(`Unknown argument: ${arg}`);
  }
  if (!parsed.inputFile) usage("--input-file is required");
  if (!parsed.sourceId && !parsed.state) usage("--source-id or --state is required");
  return parsed;
}

function usage(error) {
  if (error) console.error(error);
  console.error(`Usage:
  node scripts/validate-builder-sanctioned-extract.mjs --input-file extract.csv --state SA [--format csv] [--permission-reference ref] [--permission-file permission.txt] [--write] [--output-file source-extract-validation-sa.json] [--fail-on-hard-failures]

When --write is used without --output-file, the report defaults to source-extract-validation-<state>.json.`);
  process.exit(error ? 1 : 0);
}

function buildDefaultOutputFile(validation) {
  const suffix = (validation.state ?? validation.sourceId ?? "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `source-extract-validation-${suffix}.json`;
}

async function updateManifestFileMetadata({ manifest, manifestPath, filepath, filename, rowCount }) {
  const fileStat = await stat(filepath);
  manifest.files ??= {};
  manifest.files[filename] = {
    format: "json",
    rowCount,
    bytes: fileStat.size,
    sha256: await sha256File(filepath),
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
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
