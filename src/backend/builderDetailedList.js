import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import path from "node:path";
import { DEFAULT_BUILDER_DATA_DIR, assertSafeBuilderArtifactFilename } from "./builderArtifacts.js";
import { compactArray } from "./utils.js";

export const BUILDER_DETAILED_LIST_FIELDS = [
  "builderId",
  "name",
  "tradingNames",
  "states",
  "primaryState",
  "status",
  "builderType",
  "homeTypes",
  "serviceRegions",
  "postcodes",
  "addresses",
  "websiteUrl",
  "abn",
  "acn",
  "licenceCount",
  "licenceNumbers",
  "licenceClasses",
  "licenceTypes",
  "licenceStatuses",
  "licenceSources",
  "sourceIds",
  "rawSourceUrls",
  "lastCheckedAt",
  "confidence",
  "officialLicenceRecord",
  "businessIdentityMatched",
  "websiteEnriched",
  "memoryCardId",
  "ragNamespace",
  "limitations",
  "evidenceNotes",
];

export async function buildDetailedBuilderRecord(builder, licences = [], memoryCard = null) {
  const sortedLicences = [...licences].sort((a, b) => {
    const stateCompare = String(a.state ?? "").localeCompare(String(b.state ?? ""));
    if (stateCompare) return stateCompare;
    return String(a.licenceNumber ?? "").localeCompare(String(b.licenceNumber ?? ""));
  });
  const confidenceValues = [
    ...sortedLicences.map((licence) => licence.confidence),
    memoryCard?.confidence,
  ].filter((value) => Number.isFinite(value));
  const confidence = confidenceValues.length
    ? Number((confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length).toFixed(2))
    : 0;
  const postcodes = uniqueStrings([
    ...(builder.serviceRegions ?? []),
    ...sortedLicences.map((licence) => licence.postcode),
  ]);
  const sourceIds = uniqueStrings([...(builder.sourceIds ?? []), ...sortedLicences.map((licence) => licence.sourceId)]);
  const rawSourceUrls = uniqueStrings(sortedLicences.map((licence) => licence.rawSourceUrl));
  const lastCheckedAtValues = sortedLicences.map((licence) => licence.lastCheckedAt).filter((value) => Number.isFinite(value));
  const lastCheckedAt = lastCheckedAtValues.length ? new Date(Math.max(...lastCheckedAtValues)).toISOString() : null;
  const limitations = buildDetailedLimitations(builder, sortedLicences, memoryCard);

  return {
    schemaVersion: 1,
    builderId: builder.id,
    name: builder.name,
    tradingNames: builder.tradingNames ?? [],
    states: builder.states ?? [],
    primaryState: builder.states?.[0] ?? null,
    status: builder.status ?? "unknown",
    builderType: builder.builderType ?? "unknown",
    homeTypes: builder.homeTypes ?? [],
    serviceRegions: builder.serviceRegions ?? [],
    postcodes,
    addresses: builder.addresses ?? [],
    websiteUrl: builder.websiteUrl ?? null,
    abn: builder.abn ?? null,
    acn: builder.acn ?? null,
    licenceCount: sortedLicences.length,
    licences: sortedLicences.map((licence) => ({
      licenceId: licence.id,
      source: licence.source,
      sourceId: licence.sourceId,
      state: licence.state,
      licenceNumber: licence.licenceNumber,
      licenceClass: licence.licenceClass ?? null,
      licenceType: licence.licenceType ?? null,
      status: licence.status ?? "unknown",
      restrictions: licence.restrictions ?? [],
      postcode: licence.postcode ?? null,
      rawSourceUrl: licence.rawSourceUrl ?? null,
      lastCheckedAt: Number.isFinite(licence.lastCheckedAt) ? new Date(licence.lastCheckedAt).toISOString() : null,
      confidence: licence.confidence ?? 0,
    })),
    licenceNumbers: uniqueStrings(sortedLicences.map((licence) => licence.licenceNumber)),
    licenceClasses: uniqueStrings(sortedLicences.map((licence) => licence.licenceClass)),
    licenceTypes: uniqueStrings(sortedLicences.map((licence) => licence.licenceType)),
    licenceStatuses: uniqueStrings(sortedLicences.map((licence) => licence.status)),
    licenceSources: uniqueStrings(sortedLicences.map((licence) => licence.source)),
    sourceIds,
    rawSourceUrls,
    lastCheckedAt,
    confidence,
    officialLicenceRecord: Boolean(builder.evidenceQuality?.officialLicenceRecord),
    businessIdentityMatched: Boolean(builder.evidenceQuality?.businessIdentityMatched),
    websiteEnriched: Boolean(builder.evidenceQuality?.websiteEnriched),
    memoryCardId: memoryCard?.id ?? null,
    ragNamespace: memoryCard?.ragNamespace ?? "builders",
    limitations,
    evidenceNotes: buildEvidenceNotes(builder, sortedLicences, memoryCard, limitations),
  };
}

export async function writeDetailedBuilderList(options = {}) {
  const dataDir = options.dataDir ?? DEFAULT_BUILDER_DATA_DIR;
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const outputNdjson = assertSafeBuilderArtifactFilename(options.outputNdjson ?? "builder-detailed-list.ndjson", "builder detailed-list NDJSON filename");
  const outputCsv = assertSafeBuilderArtifactFilename(options.outputCsv ?? "builder-detailed-list.csv", "builder detailed-list CSV filename");
  const outputSummary = assertSafeBuilderArtifactFilename(options.outputSummary ?? "builder-detailed-list-summary.json", "builder detailed-list summary filename");
  const limit = Number.isFinite(options.limit) ? Math.max(1, Math.floor(options.limit)) : null;
  await mkdir(dataDir, { recursive: true });

  const manifest = JSON.parse(await readFile(path.join(dataDir, "manifest.json"), "utf8"));
  const licencesByBuilder = new Map();
  for await (const licence of readNdjson(path.join(dataDir, "builder-licences.ndjson"))) {
    const rows = licencesByBuilder.get(licence.builderId) ?? [];
    rows.push(licence);
    licencesByBuilder.set(licence.builderId, rows);
  }

  const memoryCardsByBuilder = new Map();
  for await (const card of readNdjson(path.join(dataDir, "builder-memory-cards.ndjson"))) {
    memoryCardsByBuilder.set(card.builderId, card);
  }

  const ndjsonPath = path.join(dataDir, outputNdjson);
  const csvPath = path.join(dataDir, outputCsv);
  const ndjsonStream = createWriteStream(ndjsonPath, { encoding: "utf8" });
  const csvStream = createWriteStream(csvPath, { encoding: "utf8" });
  csvStream.write(`${BUILDER_DETAILED_LIST_FIELDS.join(",")}\n`);

  const byState = {};
  const limitationCounts = {};
  const evidenceCounts = {
    officialLicenceRecord: 0,
    businessIdentityMatched: 0,
    websiteEnriched: 0,
    hasWebsiteUrl: 0,
    hasAddress: 0,
    hasServiceRegion: 0,
    hasMemoryCard: 0,
  };
  let rows = 0;
  let licenceRows = 0;

  for await (const builder of readNdjson(path.join(dataDir, "builders.ndjson"))) {
    if (limit && rows >= limit) break;
    const licences = licencesByBuilder.get(builder.id) ?? [];
    const memoryCard = memoryCardsByBuilder.get(builder.id) ?? null;
    const record = await buildDetailedBuilderRecord(builder, licences, memoryCard);
    rows += 1;
    licenceRows += licences.length;
    for (const state of record.states) {
      byState[state] ??= { builders: 0, licences: 0 };
      byState[state].builders += 1;
      byState[state].licences += licences.filter((licence) => licence.state === state).length;
    }
    if (record.officialLicenceRecord) evidenceCounts.officialLicenceRecord += 1;
    if (record.businessIdentityMatched) evidenceCounts.businessIdentityMatched += 1;
    if (record.websiteEnriched) evidenceCounts.websiteEnriched += 1;
    if (record.websiteUrl) evidenceCounts.hasWebsiteUrl += 1;
    if (record.addresses.length) evidenceCounts.hasAddress += 1;
    if (record.serviceRegions.length) evidenceCounts.hasServiceRegion += 1;
    if (record.memoryCardId) evidenceCounts.hasMemoryCard += 1;
    for (const limitation of record.limitations) {
      limitationCounts[limitation] = (limitationCounts[limitation] ?? 0) + 1;
    }
    ndjsonStream.write(`${JSON.stringify(record)}\n`);
    csvStream.write(`${toCsvRow(record)}\n`);
  }

  await Promise.all([endStream(ndjsonStream), endStream(csvStream)]);
  const files = {
    [outputNdjson]: await fileMetadata(ndjsonPath, "ndjson", rows),
    [outputCsv]: await fileMetadata(csvPath, "csv", rows),
  };
  const summary = {
    schemaVersion: 1,
    generatedAt,
    sourceManifestGeneratedAt: manifest.generatedAt,
    sourceImportedStates: manifest.importedStates ?? [],
    sourcePendingStates: manifest.pendingStates ?? [],
    outputFiles: { ndjson: outputNdjson, csv: outputCsv },
    totals: {
      builders: rows,
      licences: licenceRows,
      sourceBuilders: manifest.totals?.builders ?? null,
      sourceLicences: manifest.totals?.licences ?? null,
    },
    byState,
    evidenceCounts,
    limitationCounts,
    files,
    limitations: [
      "Rows are derived from official imported licence artifacts and recorded enrichment evidence only.",
      "SA and TAS remain excluded until a sanctioned official source path is implemented.",
      "Website, ABN, price, capacity and quote behaviour fields remain unknown unless evidence-backed enrichment has populated them.",
    ],
  };
  await writeJson(path.join(dataDir, outputSummary), summary);
  summary.files[outputSummary] = await fileMetadata(path.join(dataDir, outputSummary), "json", 1);
  await writeJson(path.join(dataDir, outputSummary), summary);
  return summary;
}

function buildDetailedLimitations(builder, licences, memoryCard) {
  const limitations = [];
  if (!licences.length) limitations.push("licence evidence not recorded");
  if (!builder.websiteUrl) limitations.push("website not recorded");
  if (!builder.abn) limitations.push("ABN not recorded");
  if (!builder.serviceRegions?.length) limitations.push("service regions not recorded");
  if (!builder.addresses?.length) limitations.push("address not recorded");
  if (!memoryCard) limitations.push("builder memory card not generated");
  if (!builder.evidenceQuality?.websiteEnriched) limitations.push("website, pricing, capacity and quote behaviour not enriched");
  return limitations;
}

function buildEvidenceNotes(builder, licences, memoryCard, limitations) {
  const notes = [];
  if (builder.evidenceQuality?.officialLicenceRecord) notes.push("official licence source imported");
  if (builder.evidenceQuality?.businessIdentityMatched) notes.push("business identity present from imported source");
  if (builder.evidenceQuality?.websiteEnriched) notes.push("website enrichment present");
  if (memoryCard) notes.push("RAG memory card generated");
  if (licences.length) notes.push(`${licences.length} licence evidence row${licences.length === 1 ? "" : "s"}`);
  if (limitations.length) notes.push(`limitations: ${limitations.join("; ")}`);
  return notes;
}

function toCsvRow(record) {
  return BUILDER_DETAILED_LIST_FIELDS.map((field) => csvCell(record[field])).join(",");
}

function csvCell(value) {
  if (Array.isArray(value)) return quoteCsv(value.join(" | "));
  if (value && typeof value === "object") return quoteCsv(JSON.stringify(value));
  return quoteCsv(value ?? "");
}

function quoteCsv(value) {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function uniqueStrings(values) {
  return [...new Set(compactArray(values).map((value) => String(value).trim()).filter(Boolean))].sort();
}

async function* readNdjson(filepath) {
  const rl = createInterface({ input: createReadStream(filepath) });
  for await (const line of rl) {
    if (line.trim()) yield JSON.parse(line);
  }
}

async function endStream(stream) {
  await new Promise((resolve, reject) => {
    stream.on("error", reject);
    stream.end(resolve);
  });
}

async function fileMetadata(filepath, format, rowCount) {
  const metadata = await stat(filepath);
  return {
    format,
    rowCount,
    bytes: metadata.size,
    sha256: await sha256File(filepath),
  };
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

async function writeJson(filepath, value) {
  await writeFile(filepath, `${JSON.stringify(value, null, 2)}\n`);
}
