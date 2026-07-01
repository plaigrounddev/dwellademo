#!/usr/bin/env node
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_BUILDER_DATA_DIR, assertSafeBuilderArtifactFilename, buildBuilderSourceAccessReport, listBuilderDataSources } from "../src/backend/index.js";

const options = parseArgs(process.argv.slice(2));
options.outputFile = assertSafeBuilderArtifactFilename(options.outputFile, "source access report output filename");
options.sourcesFile = assertSafeBuilderArtifactFilename(options.sourcesFile, "source access sources filename");
const manifestPath = path.join(options.dataDir, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const generatedAt = options.generatedAt ?? manifest.generatedAt;
const report = buildBuilderSourceAccessReport({
  sourceStats: manifest.sourceStats ?? [],
  generatedAt,
});
const sources = listBuilderDataSources();

if (options.write) {
  await mkdir(options.dataDir, { recursive: true });
  await writeJson(path.join(options.dataDir, options.sourcesFile), sources);
  await writeJson(path.join(options.dataDir, options.outputFile), report);
  await refreshManifestFileMetadata(manifest, options.dataDir, [
    { filename: options.sourcesFile, format: "json", rowCount: sources.length },
    { filename: options.outputFile, format: "json", rowCount: 1 },
  ]);
  await writeJson(manifestPath, manifest);
}

printJson({
  status: options.write ? "written" : "dry_run_ok",
  outputFile: options.outputFile,
  sourcesFile: options.sourcesFile,
  generatedAt: report.generatedAt,
  importedStates: report.importedStates,
  pendingStates: report.pendingStates,
  pendingSources: report.pendingSources.map((source) => ({
    state: source.state,
    sourceId: source.sourceId,
    evidenceCount: source.evidence?.length ?? 0,
  })),
  rejectedCandidates: report.rejectedCandidates.length,
});

function parseArgs(args) {
  const parsed = {
    dataDir: DEFAULT_BUILDER_DATA_DIR,
    outputFile: "source-access-report.json",
    sourcesFile: "sources.json",
    write: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--data-dir") {
      parsed.dataDir = args[++index];
    } else if (arg === "--generated-at") {
      parsed.generatedAt = args[++index];
    } else if (arg === "--output-file") {
      parsed.outputFile = args[++index];
    } else if (arg === "--sources-file") {
      parsed.sourcesFile = args[++index];
    } else if (arg === "--write") {
      parsed.write = true;
    } else if (arg === "--help" || arg === "-h") {
      usage();
    } else {
      usage(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

async function writeJson(filepath, value) {
  await writeFile(filepath, `${JSON.stringify(value, null, 2)}\n`);
}

async function refreshManifestFileMetadata(manifest, dataDir, files) {
  manifest.files ??= {};
  for (const file of files) {
    const filepath = path.join(dataDir, file.filename);
    const fileStat = await stat(filepath);
    manifest.files[file.filename] = {
      format: file.format,
      rowCount: file.rowCount,
      bytes: fileStat.size,
      sha256: await sha256File(filepath),
    };
  }
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
  node scripts/generate-builder-source-access-report.mjs [--write] [--data-dir data/builders] [--generated-at ISO_DATE]`);
  process.exit(error ? 1 : 0);
}
