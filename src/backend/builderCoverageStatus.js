import { readFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_BUILDER_DATA_DIR } from "./builderArtifacts.js";

export async function getBuilderCoverageStatus(dataDir = DEFAULT_BUILDER_DATA_DIR) {
  const [manifest, sourceAccessReport, sourceAccessRecheck] = await Promise.all([
    readJson(path.join(dataDir, "manifest.json")),
    readJson(path.join(dataDir, "source-access-report.json")),
    readOptionalJson(path.join(dataDir, "source-access-recheck.json")),
  ]);

  return buildBuilderCoverageStatus({ manifest, sourceAccessReport, sourceAccessRecheck });
}

export function buildBuilderCoverageStatus({ manifest, sourceAccessReport, sourceAccessRecheck }) {
  const importedStates = buildImportedStates(manifest);
  const pendingStates = buildPendingStates({
    manifestPendingStates: manifest?.pendingStates ?? [],
    pendingSources: sourceAccessReport?.pendingSources ?? [],
    sourceAccessRecheck,
  });
  const limitations = [
    "Coverage status describes Dwella's imported official builder evidence, not national completeness.",
    ...(manifest?.limitations ?? []),
    ...(sourceAccessReport?.limitations ?? []),
    ...(sourceAccessRecheck?.limitations ?? []),
  ];

  return {
    generatedAt: manifest?.generatedAt ?? null,
    sourceAccessGeneratedAt: sourceAccessReport?.generatedAt ?? null,
    sourceAccessLastCheckedAt: sourceAccessRecheck?.checkedAt ?? null,
    totals: {
      builders: manifest?.totals?.builders ?? 0,
      licences: manifest?.totals?.licences ?? 0,
      memoryCards: manifest?.files?.["builder-memory-cards.ndjson"]?.rowCount ?? 0,
      searchFacets: manifest?.files?.["builder-search-index.ndjson"]?.rowCount ?? 0,
      duplicateReviews: manifest?.files?.["builder-duplicate-review.ndjson"]?.rowCount ?? 0,
    },
    coverage: {
      importedStateCount: importedStates.length,
      pendingStateCount: pendingStates.length,
      importedStates: importedStates.map((state) => state.state),
      pendingStates: pendingStates.map((state) => state.state),
    },
    importedStates,
    pendingStates,
    limitations: [...new Set(limitations.filter(Boolean))],
  };
}

function buildImportedStates(manifest) {
  const sourceStatsByState = new Map();
  for (const stat of manifest?.sourceStats ?? []) {
    if (!stat.state) continue;
    const existing = sourceStatsByState.get(stat.state) ?? [];
    existing.push(stat);
    sourceStatsByState.set(stat.state, existing);
  }

  return (manifest?.importedStates ?? []).map((state) => {
    const byState = manifest?.byState?.[state] ?? {};
    const sourceStats = sourceStatsByState.get(state) ?? [];
    return {
      state,
      builders: byState.builders ?? sum(sourceStats, "builderRowsAccepted"),
      licences: byState.licences ?? 0,
      sources: sourceStats.map((stat) => ({
        sourceId: stat.sourceId,
        rawRowsRead: stat.rawRowsRead ?? 0,
        builderRowsAccepted: stat.builderRowsAccepted ?? 0,
        totalAvailable: stat.totalAvailable ?? null,
        complete: Boolean(stat.complete),
        url: stat.url ?? null,
      })),
    };
  });
}

function buildPendingStates({ manifestPendingStates, pendingSources, sourceAccessRecheck }) {
  const recheckBySourceId = new Map((sourceAccessRecheck?.results ?? []).map((result) => [result.sourceId, result]));
  const sourcesByState = new Map(pendingSources.map((source) => [source.state, source]));
  const states = [...new Set([...manifestPendingStates, ...pendingSources.map((source) => source.state)])].sort();

  return states.map((state) => {
    const source = sourcesByState.get(state) ?? { state };
    const recheck = recheckBySourceId.get(source.sourceId);
    const evidence = source.evidence ?? [];
    const primaryEvidence = evidence.find((item) => item.importDecision?.startsWith("pending_")) ?? evidence[0];

    return {
      state,
      sourceId: source.sourceId ?? null,
      sourceName: source.sourceName ?? null,
      sourceType: source.sourceType ?? null,
      url: source.url ?? null,
      searchUrl: source.searchUrl ?? null,
      accessStatus: source.accessStatus ?? null,
      observedAccessStatus: recheck?.observedAccessStatus ?? null,
      importDecision: recheck?.importDecision ?? primaryEvidence?.importDecision ?? "not_imported",
      lastCheckedAt: recheck?.checkedAt ?? primaryEvidence?.checkedAt ?? null,
      reason: source.notes ?? primaryEvidence?.finding ?? source.accessStatus ?? "Pending official source access.",
      nextStep: nextStepForPendingSource(source, recheck),
    };
  });
}

function nextStepForPendingSource(source, recheck) {
  const status = recheck?.observedAccessStatus ?? source?.accessStatus ?? "";
  if (status.includes("recaptcha")) return "Request a sanctioned bulk extract, documented API or written permission before import.";
  if (status.includes("salesforce")) return "Identify a stable official extract/API or sanctioned server-side access path before import.";
  if (status.includes("cloudflare")) return "Use an official extract/API or owner-provided access path; do not bypass challenge controls.";
  return "Import only after a production-safe official extract, documented API or sanctioned access path is available.";
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
}

async function readJson(filepath) {
  return JSON.parse(await readFile(filepath, "utf8"));
}

async function readOptionalJson(filepath) {
  try {
    return await readJson(filepath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}
