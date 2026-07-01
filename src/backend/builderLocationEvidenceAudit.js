import { createReadStream, createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { finished } from "node:stream/promises";
import path from "node:path";
import { DEFAULT_BUILDER_DATA_DIR, assertSafeBuilderArtifactFilename } from "./builderArtifacts.js";

export async function buildBuilderLocationEvidenceAudit(options = {}) {
  const dataDir = options.dataDir ?? DEFAULT_BUILDER_DATA_DIR;
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const buildersPath = path.join(dataDir, "builders.ndjson");
  const licencesPath = path.join(dataDir, "builder-licences.ndjson");
  const buildersWithLocationGaps = new Map();
  const byState = {};
  let builders = 0;
  let missingServiceRegions = 0;
  let missingAddresses = 0;

  for await (const builder of readNdjson(buildersPath)) {
    builders += 1;
    for (const state of builder.states ?? ["unknown"]) {
      byState[state] ??= emptyStateStats();
      byState[state].builders += 1;
    }

    const missingServiceRegion = !builder.serviceRegions?.length;
    const missingAddress = !builder.addresses?.length;
    if (missingServiceRegion) missingServiceRegions += 1;
    if (missingAddress) missingAddresses += 1;
    if (!missingServiceRegion && !missingAddress) continue;

    buildersWithLocationGaps.set(builder.id, {
      builderId: builder.id,
      name: builder.name,
      states: builder.states ?? [],
      missingServiceRegion,
      missingAddress,
      linkedLicences: 0,
      licenceRowsWithPostcode: 0,
      licenceRowsWithAddress: 0,
      recoverableServiceRegionFromLicence: false,
      recoverableAddressFromLicence: false,
      sources: new Set(),
    });
    for (const state of builder.states ?? ["unknown"]) {
      byState[state] ??= emptyStateStats();
      if (missingServiceRegion) byState[state].missingServiceRegions += 1;
      if (missingAddress) byState[state].missingAddresses += 1;
    }
  }

  let licences = 0;
  let licenceRowsForGapBuilders = 0;
  let licenceRowsWithPostcodeForGapBuilders = 0;
  let licenceRowsWithAddressForGapBuilders = 0;

  for await (const licence of readNdjson(licencesPath)) {
    licences += 1;
    const gap = buildersWithLocationGaps.get(licence.builderId);
    if (!gap) continue;
    gap.linkedLicences += 1;
    licenceRowsForGapBuilders += 1;
    if (licence.sourceId) gap.sources.add(licence.sourceId);
    if (licence.postcode) {
      gap.licenceRowsWithPostcode += 1;
      licenceRowsWithPostcodeForGapBuilders += 1;
      if (gap.missingServiceRegion) gap.recoverableServiceRegionFromLicence = true;
    }
    if (licence.address) {
      gap.licenceRowsWithAddress += 1;
      licenceRowsWithAddressForGapBuilders += 1;
      if (gap.missingAddress) gap.recoverableAddressFromLicence = true;
    }
  }

  const recoverableServiceRegionBuilders = [...buildersWithLocationGaps.values()].filter((item) => item.recoverableServiceRegionFromLicence).length;
  const recoverableAddressBuilders = [...buildersWithLocationGaps.values()].filter((item) => item.recoverableAddressFromLicence).length;
  const unrecoverableExamples = [...buildersWithLocationGaps.values()]
    .filter((item) => (item.missingServiceRegion || item.missingAddress) && !item.recoverableServiceRegionFromLicence && !item.recoverableAddressFromLicence)
    .slice(0, options.exampleLimit ?? 10)
    .map((item) => ({
      builderId: item.builderId,
      name: item.name,
      states: item.states,
      missingServiceRegion: item.missingServiceRegion,
      missingAddress: item.missingAddress,
      linkedLicences: item.linkedLicences,
      sources: [...item.sources].sort(),
    }));

  return {
    schemaVersion: 1,
    generatedAt,
    sourceFiles: ["builders.ndjson", "builder-licences.ndjson"],
    totals: {
      builders,
      licences,
      buildersWithAnyLocationGap: buildersWithLocationGaps.size,
      missingServiceRegions,
      missingAddresses,
      licenceRowsForGapBuilders,
      licenceRowsWithPostcodeForGapBuilders,
      licenceRowsWithAddressForGapBuilders,
      recoverableServiceRegionBuilders,
      recoverableAddressBuilders,
    },
    byState,
    unrecoverableExamples,
    conclusions: [
      recoverableServiceRegionBuilders
        ? `${recoverableServiceRegionBuilders} builders missing service regions have postcode evidence in linked licence rows.`
        : "No builders missing service regions have postcode evidence in linked licence rows.",
      recoverableAddressBuilders
        ? `${recoverableAddressBuilders} builders missing addresses have address evidence in linked licence rows.`
        : "No builders missing addresses have address evidence in linked licence rows.",
      "Do not backfill service regions or addresses unless official licence evidence, fetched website evidence, or another sanctioned source provides the value.",
    ],
  };
}

export async function writeBuilderLocationEvidenceAudit(options = {}) {
  const dataDir = options.dataDir ?? DEFAULT_BUILDER_DATA_DIR;
  const outputDir = options.outputDir ?? dataDir;
  const outputFilename = assertSafeBuilderArtifactFilename(
    options.outputFilename ?? "builder-location-evidence-audit.json",
    "builder location evidence audit output filename"
  );
  await mkdir(outputDir, { recursive: true });
  const audit = await buildBuilderLocationEvidenceAudit(options);
  const outputPath = path.join(outputDir, outputFilename);
  await writeJsonFile(outputPath, audit);
  return { outputPath, audit };
}

function emptyStateStats() {
  return {
    builders: 0,
    missingServiceRegions: 0,
    missingAddresses: 0,
  };
}

async function* readNdjson(filepath) {
  const rl = createInterface({ input: createReadStream(filepath) });
  for await (const line of rl) {
    if (line.trim()) yield JSON.parse(line);
  }
}

async function writeJsonFile(filepath, value) {
  const output = createWriteStream(filepath, { encoding: "utf8" });
  output.end(`${JSON.stringify(value, null, 2)}\n`);
  await finished(output);
}
