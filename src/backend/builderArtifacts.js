import { createReadStream } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import path from "node:path";
import { BackendError } from "./errors.js";
import { compactArray, normalizeState, normalizeText } from "./utils.js";

export const DEFAULT_BUILDER_DATA_DIR = path.join(process.cwd(), "data", "builders");

export function assertSafeBuilderArtifactFilename(filename, label = "builder artifact filename") {
  const text = String(filename ?? "").trim();
  if (!text) throw new BackendError("validation.required", `${label} is required`);
  if (
    path.isAbsolute(text) ||
    text !== path.basename(text) ||
    text.includes("/") ||
    text.includes("\\") ||
    text.includes("\0") ||
    text === "." ||
    text === ".."
  ) {
    throw new BackendError("validation.invalid", `${label} must be a filename inside the builder artifact directory`, { filename: text });
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(text)) {
    throw new BackendError("validation.invalid", `${label} contains unsupported characters`, { filename: text });
  }
  return text;
}

export async function assertNewBuilderArtifactPath(filepath, label = "builder artifact", options = {}) {
  if (options.overwrite) return;
  try {
    await access(filepath);
    throw new BackendError("validation.conflict", `${label} already exists; pass --overwrite only when intentionally replacing recorded evidence`, { filepath });
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
}

export async function readBuilderArtifactManifest(dataDir = DEFAULT_BUILDER_DATA_DIR) {
  const [manifest, sourceAccessReport] = await Promise.all([
    readJson(path.join(dataDir, "manifest.json")),
    readJson(path.join(dataDir, "source-access-report.json")),
  ]);

  return {
    manifest,
    sourceAccessReport,
    totals: manifest.totals,
    importedStates: manifest.importedStates ?? [],
    pendingStates: manifest.pendingStates ?? [],
    generatedAt: manifest.generatedAt,
    files: manifest.files ?? {},
  };
}

export async function searchBuilderArtifacts(search = {}, options = {}) {
  const dataDir = options.dataDir ?? DEFAULT_BUILDER_DATA_DIR;
  const limit = Math.max(1, Math.min(options.limit ?? 25, 100));
  const minScore = options.minScore ?? 1;
  const matches = [];

  await readBuilderArtifactManifest(dataDir);

  for await (const row of readNdjson(path.join(dataDir, "builder-search-index.ndjson"))) {
    if (!matchesExplicitFilters(row, search)) continue;
    const scored = scoreSearchIndexRow(row, search);
    if (scored.score < minScore) continue;
    matches.push({
      builderId: row.builderId,
      name: row.name,
      states: row.states ?? [],
      postcodes: row.postcodes ?? [],
      licenceClasses: row.licenceClasses ?? [],
      licenceNumbers: row.licenceNumbers ?? [],
      sources: row.sources ?? [],
      sourceIds: row.sourceIds ?? [],
      evidenceQuality: row.evidenceQuality,
      confidence: row.confidence ?? 0,
      score: scored.score,
      reasons: scored.reasons,
      memoryCardId: row.memoryCardId,
    });
  }

  return matches.sort((a, b) => b.score - a.score || b.confidence - a.confidence || a.name.localeCompare(b.name)).slice(0, limit);
}

export async function getBuilderArtifactEvidence(builderId, options = {}) {
  if (!builderId) throw new BackendError("builder_artifacts.builder_id_required", "builderId is required");
  const dataDir = options.dataDir ?? DEFAULT_BUILDER_DATA_DIR;
  await readBuilderArtifactManifest(dataDir);

  const [builder, memoryCard, licences] = await Promise.all([
    findFirstNdjson(path.join(dataDir, "builders.ndjson"), (row) => row.id === builderId),
    findFirstNdjson(path.join(dataDir, "builder-memory-cards.ndjson"), (row) => row.builderId === builderId),
    collectNdjson(path.join(dataDir, "builder-licences.ndjson"), (row) => row.builderId === builderId),
  ]);

  if (!builder) throw new BackendError("builder_artifacts.not_found", "Builder artifact not found", { builderId });

  return {
    builder,
    licences,
    memoryCard,
    evidenceQuality: builder.evidenceQuality,
    sourceIds: builder.sourceIds ?? [],
    limitations: buildArtifactLimitations(builder, memoryCard),
  };
}

export async function searchBuilderDuplicateReviewArtifacts(search = {}, options = {}) {
  const dataDir = options.dataDir ?? DEFAULT_BUILDER_DATA_DIR;
  const limit = Math.max(1, Math.min(options.limit ?? 25, 100));
  const minBuilderCount = Math.max(2, options.minBuilderCount ?? 2);
  const queryTerms = tokenize(search.query);
  const state = normalizeState(search.state);
  const reviewReason = normalizeText(search.reviewReason);
  const confidence = normalizeText(search.confidence);
  const matches = [];

  await readBuilderArtifactManifest(dataDir);

  for await (const row of readNdjson(path.join(dataDir, "builder-duplicate-review.ndjson"))) {
    if ((row.builderCount ?? 0) < minBuilderCount) continue;
    if (state && !row.states?.includes(state)) continue;
    if (reviewReason && normalizeText(row.reviewReason) !== reviewReason) continue;
    if (confidence && normalizeText(row.confidence) !== confidence) continue;

    const text = normalizeText([
      row.normalizedName,
      ...(row.displayNames ?? []),
      ...(row.states ?? []),
      ...(row.sourceIds ?? []),
      ...(row.businessNumbers?.abns ?? []),
      ...(row.businessNumbers?.acns ?? []),
    ].join(" "));
    if (queryTerms.length && !queryTerms.every((term) => text.includes(term))) continue;

    matches.push({
      id: row.id,
      normalizedName: row.normalizedName,
      displayNames: row.displayNames ?? [],
      reviewReason: row.reviewReason,
      reviewOnly: row.reviewOnly,
      autoMerge: row.autoMerge,
      confidence: row.confidence,
      builderCount: row.builderCount,
      states: row.states ?? [],
      builderIds: row.builderIds ?? [],
      sourceIds: row.sourceIds ?? [],
      businessNumbers: row.businessNumbers ?? { abns: [], acns: [] },
      licenceCount: row.licences?.length ?? 0,
      notes: row.notes ?? [],
    });
  }

  return matches.sort((a, b) => b.builderCount - a.builderCount || a.normalizedName.localeCompare(b.normalizedName)).slice(0, limit);
}

function matchesExplicitFilters(row, search) {
  const state = normalizeState(search.state);
  const postcode = normalizeText(search.postcode);
  const licenceClass = normalizeText(search.licenceClass);
  const source = normalizeText(search.source);

  if (state && !row.states?.includes(state)) return false;
  if (postcode && !row.postcodes?.some((value) => normalizeText(value) === postcode)) return false;
  if (licenceClass && !row.licenceClasses?.some((value) => normalizeText(value).includes(licenceClass))) return false;
  if (source && !row.sources?.some((value) => normalizeText(value) === source)) return false;
  return true;
}

function scoreSearchIndexRow(row, search) {
  let score = 0;
  const reasons = [];
  const state = normalizeState(search.state);
  const postcode = normalizeText(search.postcode);
  const licenceClass = normalizeText(search.licenceClass);
  const source = normalizeText(search.source);
  const queryTerms = tokenize(search.query);
  const mustHaveTerms = compactArray(search.mustHaves).flatMap(tokenize);
  const searchableText = normalizeText(row.searchableText);

  if (state && row.states?.includes(state)) {
    score += 30;
    reasons.push(`state:${state}`);
  }
  if (postcode && row.postcodes?.some((value) => normalizeText(value) === postcode)) {
    score += 20;
    reasons.push(`postcode:${postcode}`);
  }
  if (licenceClass && row.licenceClasses?.some((value) => normalizeText(value).includes(licenceClass))) {
    score += 15;
    reasons.push(`licenceClass:${search.licenceClass}`);
  }
  if (source && row.sources?.some((value) => normalizeText(value) === source)) {
    score += 10;
    reasons.push(`source:${search.source}`);
  }

  for (const term of queryTerms) {
    if (searchableText.includes(term)) score += 5;
  }
  if (queryTerms.length && queryTerms.every((term) => searchableText.includes(term))) {
    score += 15;
    reasons.push(`query:${search.query}`);
  }

  for (const term of mustHaveTerms) {
    if (searchableText.includes(term)) {
      score += 3;
      reasons.push(`mentions:${term}`);
    }
  }

  return { score, reasons: [...new Set(reasons)] };
}

function tokenize(value) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/i)
    .map((term) => term.trim())
    .filter((term) => term.length > 1);
}

function buildArtifactLimitations(builder, memoryCard) {
  const limitations = [];
  if (!builder.websiteUrl) limitations.push("website not recorded");
  if (!builder.abn) limitations.push("ABN not recorded");
  if (!builder.serviceRegions?.length) limitations.push("service regions not recorded");
  if (!memoryCard) limitations.push("builder memory card not generated");
  if (!builder.evidenceQuality?.websiteEnriched) limitations.push("website, pricing, capacity and quote behaviour not enriched");
  return limitations;
}

async function readJson(filepath) {
  return JSON.parse(await readFile(filepath, "utf8"));
}

async function* readNdjson(filepath) {
  const rl = createInterface({ input: createReadStream(filepath) });
  for await (const line of rl) {
    if (line.trim()) yield JSON.parse(line);
  }
}

async function findFirstNdjson(filepath, predicate) {
  for await (const row of readNdjson(filepath)) {
    if (predicate(row)) return row;
  }
  return undefined;
}

async function collectNdjson(filepath, predicate) {
  const rows = [];
  for await (const row of readNdjson(filepath)) {
    if (predicate(row)) rows.push(row);
  }
  return rows;
}
