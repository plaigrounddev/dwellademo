import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import path from "node:path";
import { DEFAULT_BUILDER_DATA_DIR, assertSafeBuilderArtifactFilename } from "./builderArtifacts.js";

export async function buildDetailedListAudit(options = {}) {
  const dataDir = options.dataDir ?? DEFAULT_BUILDER_DATA_DIR;
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const sampleLimit = Number.isFinite(options.sampleLimit) ? Math.max(0, Math.floor(options.sampleLimit)) : 10;
  const manifest = await readJson(path.join(dataDir, "manifest.json"));
  const detailedSummary = await readJson(path.join(dataDir, "builder-detailed-list-summary.json"));
  const detailedFilename = assertSafeBuilderArtifactFilename(
    options.inputFilename ?? detailedSummary.outputFiles?.ndjson ?? "builder-detailed-list.ndjson",
    "builder detailed-list audit input filename"
  );
  const detailedPath = path.join(dataDir, detailedFilename);
  const expectedBuilders = manifest.totals?.builders ?? 0;
  const expectedLicences = manifest.totals?.licences ?? 0;
  const expectedSha256 = detailedSummary.files?.[detailedFilename]?.sha256 ?? null;
  const hash = createHash("sha256");
  const byState = {};
  const limitationCounts = {};
  const violationSamples = [];
  let rows = 0;
  let licenceCount = 0;
  let officialLicenceRows = 0;
  let rowsWithMemoryCard = 0;
  let rowsWithSourceUrls = 0;
  let rowsWithWebsiteUrl = 0;
  let rowsWithAbn = 0;
  let rowsWithAddress = 0;
  let rowsWithServiceRegion = 0;
  let rowsMissingLicenceEvidence = 0;
  let rowsMissingSourceUrl = 0;
  let rowsMissingMemoryCard = 0;
  let rowsWithUnexpectedWebsiteEnrichment = 0;

  const input = createReadStream(detailedPath);
  input.on("data", (chunk) => hash.update(chunk));
  const rl = createInterface({ input });
  for await (const line of rl) {
    if (!line.trim()) continue;
    rows += 1;
    const row = JSON.parse(line);
    licenceCount += row.licenceCount ?? 0;
    if (row.officialLicenceRecord) officialLicenceRows += 1;
    if (row.memoryCardId) rowsWithMemoryCard += 1;
    if (row.rawSourceUrls?.length) rowsWithSourceUrls += 1;
    if (row.websiteUrl) rowsWithWebsiteUrl += 1;
    if (row.abn) rowsWithAbn += 1;
    if (row.addresses?.length) rowsWithAddress += 1;
    if (row.serviceRegions?.length) rowsWithServiceRegion += 1;
    if (row.websiteEnriched || row.websiteUrl) rowsWithUnexpectedWebsiteEnrichment += 1;
    if (!row.licenceCount || !Array.isArray(row.licences) || !row.licences.length) {
      rowsMissingLicenceEvidence += 1;
      addViolationSample(violationSamples, sampleLimit, row, "missing_licence_evidence");
    }
    if (!row.rawSourceUrls?.length) {
      rowsMissingSourceUrl += 1;
      addViolationSample(violationSamples, sampleLimit, row, "missing_raw_source_url");
    }
    if (!row.memoryCardId) {
      rowsMissingMemoryCard += 1;
      addViolationSample(violationSamples, sampleLimit, row, "missing_memory_card");
    }
    for (const state of row.states ?? []) {
      byState[state] ??= { builders: 0, licences: 0 };
      byState[state].builders += 1;
      byState[state].licences += (row.licences ?? []).filter((licence) => licence.state === state).length;
    }
    for (const limitation of row.limitations ?? []) {
      limitationCounts[limitation] = (limitationCounts[limitation] ?? 0) + 1;
    }
  }

  const actualSha256 = hash.digest("hex");
  const fileStat = await stat(detailedPath);
  const hardFailures = [
    rows === expectedBuilders ? null : `Detailed list row count ${rows} does not match manifest builders ${expectedBuilders}.`,
    licenceCount === expectedLicences ? null : `Detailed list licence count ${licenceCount} does not match manifest licences ${expectedLicences}.`,
    expectedSha256 && actualSha256 !== expectedSha256 ? `Detailed list sha256 ${actualSha256} does not match summary sha256 ${expectedSha256}.` : null,
    officialLicenceRows === rows ? null : `${rows - officialLicenceRows} rows are missing officialLicenceRecord=true.`,
    rowsMissingLicenceEvidence === 0 ? null : `${rowsMissingLicenceEvidence} rows are missing linked licence evidence.`,
    rowsMissingSourceUrl === 0 ? null : `${rowsMissingSourceUrl} rows are missing raw source URLs.`,
    rowsMissingMemoryCard === 0 ? null : `${rowsMissingMemoryCard} rows are missing memory-card links.`,
  ].filter(Boolean);

  return {
    schemaVersion: 1,
    generatedAt,
    sourceManifestGeneratedAt: manifest.generatedAt,
    sourceDetailedListGeneratedAt: detailedSummary.generatedAt,
    inputFile: detailedFilename,
    status: hardFailures.length ? "failed" : "passed",
    totals: {
      rows,
      expectedBuilders,
      licenceCount,
      expectedLicences,
      officialLicenceRows,
      rowsWithMemoryCard,
      rowsWithSourceUrls,
      rowsWithWebsiteUrl,
      rowsWithAbn,
      rowsWithAddress,
      rowsWithServiceRegion,
      rowsMissingLicenceEvidence,
      rowsMissingSourceUrl,
      rowsMissingMemoryCard,
      rowsWithUnexpectedWebsiteEnrichment,
    },
    byState,
    limitationCounts,
    file: {
      format: "ndjson",
      rowCount: rows,
      bytes: fileStat.size,
      sha256: actualSha256,
      expectedSha256,
    },
    hardFailures,
    violationSamples,
    conclusions: [
      rows === expectedBuilders ? "Detailed list covers every imported builder row." : "Detailed list row coverage does not match the manifest.",
      licenceCount === expectedLicences ? "Detailed list preserves every imported licence evidence row." : "Detailed list licence coverage does not match the manifest.",
      rowsWithUnexpectedWebsiteEnrichment === 0
        ? "No website enrichment is present, so website fields remain unknown rather than inferred."
        : "Website enrichment is present and must be backed by website evidence artifacts.",
      "This audit does not enrich, merge or infer builder fields; it only checks generated evidence artifacts.",
    ],
    limitations: [
      "Audit scope is limited to imported official licence artifacts and already-generated detailed-list rows.",
      "SA and TAS remain pending until sanctioned source access is implemented.",
      "Missing website, ABN, capacity, price and quote-behaviour fields are expected gaps until credentialed evidence-backed enrichment runs complete.",
    ],
  };
}

export async function writeDetailedListAudit(options = {}) {
  const dataDir = options.dataDir ?? DEFAULT_BUILDER_DATA_DIR;
  const outputFilename = assertSafeBuilderArtifactFilename(
    options.outputFilename ?? "builder-detailed-list-audit.json",
    "builder detailed-list audit output filename"
  );
  const audit = await buildDetailedListAudit({ ...options, dataDir });
  const outputPath = path.join(dataDir, outputFilename);
  await writeFile(outputPath, `${JSON.stringify(audit, null, 2)}\n`);
  return { outputPath, audit };
}

function addViolationSample(samples, sampleLimit, row, reason) {
  if (samples.length >= sampleLimit) return;
  samples.push({
    reason,
    builderId: row.builderId,
    name: row.name,
    states: row.states ?? [],
    licenceCount: row.licenceCount ?? 0,
    sourceIds: row.sourceIds ?? [],
  });
}

async function readJson(filepath) {
  return JSON.parse(await readFile(filepath, "utf8"));
}
