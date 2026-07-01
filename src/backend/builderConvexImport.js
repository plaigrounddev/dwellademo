import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { DEFAULT_BUILDER_DATA_DIR, assertSafeBuilderArtifactFilename } from "./builderArtifacts.js";
import { BackendError } from "./errors.js";
import { normalizeText } from "./utils.js";

export const DEFAULT_CONVEX_BUILDER_BATCH_SIZE = 100;
export const UNKNOWN_POSTCODE_FACET = "";

export async function readBuilderConvexImportMetadata(dataDir = DEFAULT_BUILDER_DATA_DIR) {
  const [manifest, sourceAccessReport] = await Promise.all([
    readJson(path.join(dataDir, "manifest.json")),
    readJson(path.join(dataDir, "source-access-report.json")),
  ]);
  const importId = makeBuilderConvexImportId(manifest);

  return {
    importId,
    importRun: toConvexImportRun(manifest, importId),
    sourceAccessReport: toConvexSourceAccessReport(sourceAccessReport, importId),
  };
}

export async function readBuilderEnrichmentConvexImportMetadata(dataDir = DEFAULT_BUILDER_DATA_DIR) {
  const summary = await readJson(path.join(dataDir, "builder-enrichment-summary.json"));
  const importId = makeBuilderEnrichmentImportId(summary);

  return {
    importId,
    enrichmentRun: toConvexEnrichmentRun(summary, importId),
    expectedJobRows: summary.totals?.jobRows ?? 0,
  };
}

export async function readBuilderWebsiteDiscoveryConvexImportMetadata(dataDir = DEFAULT_BUILDER_DATA_DIR) {
  const summary = await readJson(path.join(dataDir, "builder-website-discovery-summary.json"));
  const importId = makeBuilderWebsiteDiscoveryImportId(summary);

  return {
    importId,
    websiteDiscoveryRun: toConvexWebsiteDiscoveryRun(summary, importId),
    expectedJobRows: summary.totals?.writtenJobs ?? 0,
  };
}

export async function readBuilderWebsiteSearchRequestConvexImportMetadata(dataDir = DEFAULT_BUILDER_DATA_DIR) {
  const summary = await readJson(path.join(dataDir, "builder-website-search-requests-summary.json"));
  const importId = makeBuilderWebsiteSearchRequestImportId(summary);

  return {
    importId,
    websiteSearchRequestRun: toConvexWebsiteSearchRequestRun(summary, importId),
    expectedRows: summary.totals?.writtenRequests ?? 0,
  };
}

export async function readBuilderWebsiteCandidateConvexImportMetadata(dataDir = DEFAULT_BUILDER_DATA_DIR) {
  const summary = await readJson(path.join(dataDir, "builder-website-candidates-summary.json"));
  const importId = makeBuilderWebsiteCandidateImportId(summary);

  return {
    importId,
    websiteCandidateRun: toConvexWebsiteCandidateRun(summary, importId),
    expectedRows: summary.totals?.writtenCandidates ?? 0,
  };
}

export async function readBuilderWebsiteCorroborationConvexImportMetadata(dataDir = DEFAULT_BUILDER_DATA_DIR) {
  const summary = await readJson(path.join(dataDir, "builder-website-corroboration-summary.json"));
  const importId = makeBuilderWebsiteCorroborationImportId(summary);

  return {
    importId,
    websiteCorroborationRun: toConvexWebsiteCorroborationRun(summary, importId),
    expectedRows: summary.totals?.fetchedCandidates ?? 0,
  };
}

export async function readBuilderWebsiteUpdateProposalConvexImportMetadata(dataDir = DEFAULT_BUILDER_DATA_DIR) {
  const summary = await readJson(path.join(dataDir, "builder-website-update-proposals-summary.json"));
  const importId = makeBuilderWebsiteUpdateProposalImportId(summary);

  return {
    importId,
    websiteUpdateProposalRun: toConvexWebsiteUpdateProposalRun(summary, importId),
    expectedRows: summary.totals?.proposalRows ?? 0,
  };
}

export async function readBuilderDetailedListConvexImportMetadata(dataDir = DEFAULT_BUILDER_DATA_DIR) {
  const summary = await readJson(path.join(dataDir, "builder-detailed-list-summary.json"));
  const importId = makeBuilderDetailedListImportId(summary);

  return {
    importId,
    detailedListRun: toConvexDetailedListRun(summary, importId),
    expectedRows: summary.totals?.builders ?? 0,
  };
}

export async function readBuilderAbnLookupConvexImportMetadata(dataDir = DEFAULT_BUILDER_DATA_DIR) {
  const summary = await readJson(path.join(dataDir, "builder-abn-lookup-summary.json"));
  const importId = makeBuilderAbnLookupImportId(summary);
  return {
    importId,
    abnLookupRun: toConvexAbnLookupRun(summary, importId),
    expectedRows: summary.checkedJobs ?? 0,
  };
}

export async function readBuilderAbnMergeConvexImportMetadata(dataDir = DEFAULT_BUILDER_DATA_DIR) {
  const summary = await readJson(path.join(dataDir, "builder-abn-merge-summary.json"));
  const importId = makeBuilderAbnMergeImportId(summary);
  return {
    importId,
    abnMergeRun: toConvexAbnMergeRun(summary, importId),
    expectedRows: summary.totals?.proposalRows ?? 0,
  };
}

export async function readBuilderProductionReadinessConvexImportMetadata(dataDir = DEFAULT_BUILDER_DATA_DIR) {
  const report = await readJson(path.join(dataDir, "builder-production-readiness.json"));
  const importId = makeBuilderProductionReadinessImportId(report);
  return {
    importId,
    productionReadinessRun: toConvexProductionReadinessRun(report, importId),
  };
}

export function makeBuilderConvexImportId(manifest) {
  const generatedAt = String(manifest?.generatedAt ?? "").trim();
  if (!generatedAt) throw new Error("Builder manifest is missing generatedAt");
  return `builder-import:${generatedAt}`;
}

export function makeBuilderEnrichmentImportId(summary) {
  const generatedAt = String(summary?.generatedAt ?? "").trim();
  if (!generatedAt) throw new Error("Builder enrichment summary is missing generatedAt");
  return `builder-enrichment:${generatedAt}`;
}

export function makeBuilderWebsiteDiscoveryImportId(summary) {
  const generatedAt = String(summary?.generatedAt ?? "").trim();
  if (!generatedAt) throw new Error("Builder website discovery summary is missing generatedAt");
  return `builder-website-discovery:${generatedAt}`;
}

export function makeBuilderWebsiteSearchRequestImportId(summary) {
  const generatedAt = String(summary?.generatedAt ?? "").trim();
  if (!generatedAt) throw new Error("Builder website search request summary is missing generatedAt");
  return `builder-website-search-requests:${generatedAt}`;
}

export function makeBuilderWebsiteCandidateImportId(summary) {
  const generatedAt = String(summary?.generatedAt ?? "").trim();
  if (!generatedAt) throw new Error("Builder website candidate summary is missing generatedAt");
  return `builder-website-candidates:${generatedAt}`;
}

export function makeBuilderWebsiteCorroborationImportId(summary) {
  const fetchedAt = String(summary?.fetchedAt ?? "").trim();
  if (!fetchedAt) throw new Error("Builder website corroboration summary is missing fetchedAt");
  return `builder-website-corroboration:${fetchedAt}`;
}

export function makeBuilderWebsiteUpdateProposalImportId(summary) {
  const generatedAt = String(summary?.generatedAt ?? "").trim();
  if (!generatedAt) throw new Error("Builder website update proposal summary is missing generatedAt");
  return `builder-website-update-proposals:${generatedAt}`;
}

export function makeBuilderDetailedListImportId(summary) {
  const generatedAt = String(summary?.generatedAt ?? "").trim();
  if (!generatedAt) throw new Error("Builder detailed list summary is missing generatedAt");
  return `builder-detailed-list:${generatedAt}`;
}

export function makeBuilderAbnLookupImportId(summary) {
  const checkedAt = String(summary?.checkedAt ?? "").trim();
  if (!checkedAt) throw new Error("Builder ABN lookup summary is missing checkedAt");
  return `builder-abn-lookup:${checkedAt}`;
}

export function makeBuilderAbnMergeImportId(summary) {
  const generatedAt = String(summary?.generatedAt ?? "").trim();
  if (!generatedAt) throw new Error("Builder ABN merge summary is missing generatedAt");
  return `builder-abn-merge:${generatedAt}`;
}

export function makeBuilderProductionReadinessImportId(report) {
  const generatedAt = String(report?.generatedAt ?? "").trim();
  if (!generatedAt) throw new Error("Builder production readiness report is missing generatedAt");
  return `builder-production-readiness:${generatedAt}`;
}

export function toConvexImportRun(manifest, importId = makeBuilderConvexImportId(manifest)) {
  return stripUndefined({
    importId,
    generatedAt: manifest.generatedAt,
    importedStates: manifest.importedStates ?? [],
    pendingStates: manifest.pendingStates ?? [],
    totals: {
      builders: manifest.totals?.builders ?? 0,
      licences: manifest.totals?.licences ?? 0,
    },
    expectedTotals: expectedConvexImportTotals(manifest),
    sourceStats: (manifest.sourceStats ?? []).map((stat) =>
      stripUndefined({
        sourceId: stat.sourceId,
        state: stat.state,
        rawRowsRead: stat.rawRowsRead ?? 0,
        builderRowsAccepted: stat.builderRowsAccepted ?? 0,
        totalAvailable: stat.totalAvailable,
        complete: Boolean(stat.complete),
        url: stat.url,
      })
    ),
    limitations: manifest.limitations ?? [],
    artifactManifest: JSON.stringify(manifest),
  });
}

export function toConvexEnrichmentRun(summary, importId = makeBuilderEnrichmentImportId(summary)) {
  const jobsSha256 = requireSummaryFileSha256(summary, "builder-enrichment-jobs.ndjson", "builder enrichment jobs");
  return stripUndefined({
    importId,
    generatedAt: summary.generatedAt,
    sourceManifestGeneratedAt: summary.sourceManifestGeneratedAt,
    filterState: summary.filters?.state ?? undefined,
    filterGap: summary.filters?.gap ?? undefined,
    totals: {
      scannedBuilders: summary.totals?.scannedBuilders ?? 0,
      matchingBuilders: summary.totals?.matchingBuilders ?? 0,
      jobRows: summary.totals?.jobRows ?? 0,
      importedBuilders: summary.totals?.importedBuilders ?? 0,
      importedLicences: summary.totals?.importedLicences ?? 0,
    },
    gapCounts: toConvexGapCounts(summary.gapCounts),
    suggestedJobCounts: toConvexSuggestedJobCounts(summary.suggestedJobCounts),
    jobsSha256,
    limitations: summary.limitations ?? [],
    summaryJson: JSON.stringify(summary),
  });
}

export function toConvexWebsiteDiscoveryRun(summary, importId = makeBuilderWebsiteDiscoveryImportId(summary)) {
  const inputFile = assertSafeBuilderArtifactFilename(summary.inputFile ?? "builder-enrichment-jobs.ndjson", "website discovery input filename");
  const outputFile = assertSafeBuilderArtifactFilename(summary.outputFile ?? "builder-website-discovery-jobs.ndjson", "website discovery output filename");
  const jobsSha256 = requireSummaryFileSha256(summary, outputFile, "builder website discovery jobs");
  return stripUndefined({
    importId,
    generatedAt: summary.generatedAt,
    sourceManifestGeneratedAt: summary.sourceManifestGeneratedAt,
    inputFile,
    filterState: summary.filters?.state ?? undefined,
    totals: {
      scannedJobs: summary.totals?.scannedJobs ?? 0,
      eligibleJobs: summary.totals?.eligibleJobs ?? 0,
      writtenJobs: summary.totals?.writtenJobs ?? 0,
      searchQueries: summary.totals?.searchQueries ?? 0,
      importedBuilders: summary.totals?.importedBuilders ?? 0,
    },
    byStateJson: JSON.stringify(summary.byState ?? {}),
    jobsSha256,
    limitations: summary.limitations ?? [],
    summaryJson: JSON.stringify(summary),
  });
}

export function toConvexWebsiteSearchRequestRun(summary, importId = makeBuilderWebsiteSearchRequestImportId(summary)) {
  const inputFile = assertSafeBuilderArtifactFilename(summary.inputFile ?? "builder-website-discovery-jobs.ndjson", "website search request input filename");
  const outputFile = assertSafeBuilderArtifactFilename(summary.outputFile ?? "builder-website-search-requests.ndjson", "website search request output filename");
  const requestsSha256 = requireSummaryFileSha256(summary, outputFile, "builder website search requests");
  return {
    importId,
    generatedAt: summary.generatedAt,
    sourceManifestGeneratedAt: summary.sourceManifestGeneratedAt,
    inputFile,
    totals: {
      scannedJobs: summary.totals?.scannedJobs ?? 0,
      eligibleJobs: summary.totals?.eligibleJobs ?? 0,
      writtenRequests: summary.totals?.writtenRequests ?? 0,
      importedBuilders: summary.totals?.importedBuilders ?? 0,
    },
    byStateJson: JSON.stringify(summary.byState ?? {}),
    requestsSha256,
    limitations: summary.limitations ?? [],
    summaryJson: JSON.stringify(summary),
  };
}

export function toConvexWebsiteCandidateRun(summary, importId = makeBuilderWebsiteCandidateImportId(summary)) {
  const inputFile = assertSafeBuilderArtifactFilename(summary.inputFile ?? "builder-website-search-results.ndjson", "website candidate input filename");
  const jobsFile = assertSafeBuilderArtifactFilename(summary.jobsFile ?? "builder-website-discovery-jobs.ndjson", "website candidate jobs filename");
  const outputFile = assertSafeBuilderArtifactFilename(summary.outputFile ?? "builder-website-candidates.ndjson", "website candidate output filename");
  const candidatesSha256 = requireSummaryFileSha256(summary, outputFile, "builder website candidates");
  return {
    importId,
    generatedAt: summary.generatedAt,
    inputFile,
    jobsFile,
    totals: {
      discoveryJobs: summary.totals?.discoveryJobs ?? 0,
      scannedResultRows: summary.totals?.scannedResultRows ?? 0,
      expandedResults: summary.totals?.expandedResults ?? 0,
      skippedResults: summary.totals?.skippedResults ?? 0,
      writtenCandidates: summary.totals?.writtenCandidates ?? 0,
    },
    candidatesSha256,
    byStatusJson: JSON.stringify(summary.byStatus ?? {}),
    byProviderJson: JSON.stringify(summary.byProvider ?? {}),
    byStateJson: JSON.stringify(summary.byState ?? {}),
    limitations: summary.limitations ?? [],
    summaryJson: JSON.stringify(summary),
  };
}

export function toConvexWebsiteCorroborationRun(summary, importId = makeBuilderWebsiteCorroborationImportId(summary)) {
  const inputFile = assertSafeBuilderArtifactFilename(summary.inputFile ?? "builder-website-candidates.ndjson", "website corroboration input filename");
  const outputFile = assertSafeBuilderArtifactFilename(summary.outputFile ?? "builder-website-corroboration.ndjson", "website corroboration output filename");
  const corroborationSha256 = requireSummaryFileSha256(summary, outputFile, "builder website corroboration");
  return {
    importId,
    fetchedAt: summary.fetchedAt,
    inputFile,
    totals: {
      scannedCandidates: summary.totals?.scannedCandidates ?? 0,
      eligibleCandidates: summary.totals?.eligibleCandidates ?? 0,
      fetchedCandidates: summary.totals?.fetchedCandidates ?? 0,
      corroboratedCandidates: summary.totals?.corroboratedCandidates ?? 0,
    },
    corroborationSha256,
    byStatusJson: JSON.stringify(summary.byStatus ?? {}),
    byStateJson: JSON.stringify(summary.byState ?? {}),
    limitations: summary.limitations ?? [],
    summaryJson: JSON.stringify(summary),
  };
}

export function toConvexWebsiteUpdateProposalRun(summary, importId = makeBuilderWebsiteUpdateProposalImportId(summary)) {
  const inputFile = assertSafeBuilderArtifactFilename(summary.inputFile ?? "builder-website-corroboration.ndjson", "website update proposal input filename");
  const outputFile = assertSafeBuilderArtifactFilename(summary.outputFile ?? "builder-website-update-proposals.ndjson", "website update proposal output filename");
  const proposalsSha256 = requireSummaryFileSha256(summary, outputFile, "builder website update proposals");
  return {
    importId,
    generatedAt: summary.generatedAt,
    source: summary.source,
    inputFile,
    outputFile,
    totals: {
      scannedCorroborations: summary.totals?.scannedCorroborations ?? 0,
      proposalRows: summary.totals?.proposalRows ?? 0,
      proposedRows: summary.totals?.proposedRows ?? 0,
      manualReviewRows: summary.totals?.manualReviewRows ?? 0,
      notProposedRows: summary.totals?.notProposedRows ?? 0,
    },
    proposalsSha256,
    limitations: summary.limitations ?? [],
    summaryJson: JSON.stringify(summary),
  };
}

export function toConvexDetailedListRun(summary, importId = makeBuilderDetailedListImportId(summary)) {
  const ndjsonFile = assertSafeBuilderArtifactFilename(summary.outputFiles?.ndjson ?? "builder-detailed-list.ndjson", "builder detailed-list NDJSON filename");
  const csvFile = assertSafeBuilderArtifactFilename(summary.outputFiles?.csv ?? "builder-detailed-list.csv", "builder detailed-list CSV filename");
  const ndjsonSha256 = requireSummaryFileSha256(summary, ndjsonFile, "builder detailed-list NDJSON");
  const csvSha256 = requireSummaryFileSha256(summary, csvFile, "builder detailed-list CSV");
  return {
    importId,
    generatedAt: summary.generatedAt,
    sourceManifestGeneratedAt: summary.sourceManifestGeneratedAt,
    sourceImportedStates: summary.sourceImportedStates ?? [],
    sourcePendingStates: summary.sourcePendingStates ?? [],
    totals: {
      builders: summary.totals?.builders ?? 0,
      licences: summary.totals?.licences ?? 0,
      sourceBuilders: summary.totals?.sourceBuilders ?? 0,
      sourceLicences: summary.totals?.sourceLicences ?? 0,
    },
    ndjsonSha256,
    csvSha256,
    byStateJson: JSON.stringify(summary.byState ?? {}),
    evidenceCountsJson: JSON.stringify(summary.evidenceCounts ?? {}),
    limitationCountsJson: JSON.stringify(summary.limitationCounts ?? {}),
    limitations: summary.limitations ?? [],
    summaryJson: JSON.stringify(summary),
  };
}

export function toConvexAbnLookupRun(summary, importId = makeBuilderAbnLookupImportId(summary)) {
  const outputFile = assertSafeBuilderArtifactFilename(summary.outputFile ?? "builder-abn-lookup-results.ndjson", "ABN lookup output filename");
  requireSummaryFileSha256(summary, outputFile, "ABN lookup results");
  return {
    importId,
    checkedAt: summary.checkedAt,
    source: summary.source,
    sourceUrl: summary.sourceUrl,
    scannedJobs: summary.scannedJobs ?? 0,
    eligibleJobs: summary.eligibleJobs ?? 0,
    checkedJobs: summary.checkedJobs ?? 0,
    candidateCount: summary.candidateCount ?? 0,
    exactMatchCount: summary.exactMatchCount ?? 0,
    outputFile,
    limitations: summary.limitations ?? [],
    summaryJson: JSON.stringify(summary),
  };
}

export function toConvexAbnMergeRun(summary, importId = makeBuilderAbnMergeImportId(summary)) {
  const inputFile = assertSafeBuilderArtifactFilename(summary.inputFile ?? "builder-abn-lookup-results.ndjson", "ABN merge input filename");
  const outputFile = assertSafeBuilderArtifactFilename(summary.outputFile ?? "builder-abn-merge-proposals.ndjson", "ABN merge output filename");
  const proposalsSha256 = requireSummaryFileSha256(summary, outputFile, "ABN merge proposals");
  return {
    importId,
    generatedAt: summary.generatedAt,
    source: summary.source,
    inputFile,
    outputFile,
    totals: {
      scannedResults: summary.totals?.scannedResults ?? 0,
      proposalRows: summary.totals?.proposalRows ?? 0,
      proposedRows: summary.totals?.proposedRows ?? 0,
      manualReviewRows: summary.totals?.manualReviewRows ?? 0,
      notProposedRows: summary.totals?.notProposedRows ?? 0,
    },
    proposalsSha256,
    limitations: summary.limitations ?? [],
    summaryJson: JSON.stringify(summary),
  };
}

export function toConvexProductionReadinessRun(report, importId = makeBuilderProductionReadinessImportId(report)) {
  const summary = report.summary ?? {};
  return {
    importId,
    generatedAt: report.generatedAt,
    status: report.status ?? "unknown",
    builders: summary.builders ?? 0,
    licences: summary.licences ?? 0,
    importedStates: summary.importedStates ?? [],
    pendingStates: summary.pendingStates ?? [],
    detailedListRows: summary.detailedListRows ?? 0,
    memoryCards: summary.memoryCards ?? 0,
    enrichmentJobs: summary.enrichmentJobs ?? 0,
    websiteDiscoveryJobs: summary.websiteDiscoveryJobs ?? 0,
    websiteSearchRequests: summary.websiteSearchRequests ?? 0,
    websiteCandidateRows: summary.websiteCandidateRows ?? 0,
    websiteCorroborationRows: summary.websiteCorroborationRows ?? 0,
    websiteCorroboratedRows: summary.websiteCorroboratedRows ?? 0,
    websiteUpdateProposalRows: summary.websiteUpdateProposalRows ?? 0,
    websiteUpdateProposedRows: summary.websiteUpdateProposedRows ?? 0,
    detailedListAuditStatus: summary.detailedListAuditStatus ?? "missing",
    detailedListAuditHardFailures: summary.detailedListAuditHardFailures ?? 0,
    sourceAccessRequestRows: summary.sourceAccessRequestRows ?? 0,
    duplicateReviewRows: summary.duplicateReviewRows ?? 0,
    abnLookupRows: summary.abnLookupRows ?? 0,
    abnMergeProposalRows: summary.abnMergeProposalRows ?? 0,
    blockerCount: report.blockers?.length ?? 0,
    checksJson: JSON.stringify(report.checks ?? []),
    blockersJson: JSON.stringify(report.blockers ?? []),
    evidenceCoverageJson: JSON.stringify(report.evidenceCoverage ?? {}),
    limitations: report.limitations ?? [],
    reportJson: JSON.stringify(report),
  };
}

export function expectedConvexImportTotals(manifest) {
  return {
    builders: manifest.files?.["builders.ndjson"]?.rowCount ?? manifest.totals?.builders ?? 0,
    licences: manifest.files?.["builder-licences.ndjson"]?.rowCount ?? manifest.totals?.licences ?? 0,
    memoryCards: manifest.files?.["builder-memory-cards.ndjson"]?.rowCount ?? 0,
    searchFacets: manifest.files?.["builder-search-index.ndjson"]?.rowCount ?? 0,
    duplicateReviews: manifest.files?.["builder-duplicate-review.ndjson"]?.rowCount ?? 0,
  };
}

export function assertExpectedImportRows(label, actualRows, expectedRows) {
  if (actualRows !== expectedRows) {
    throw new BackendError("validation.mismatch", `${label} mapped ${actualRows} row(s) but expected ${expectedRows}; refusing import success`, {
      actualRows,
      expectedRows,
    });
  }
}

export function assertExpectedImportTotals(label, actualTotals, expectedTotals) {
  for (const [key, expectedRows] of Object.entries(expectedTotals ?? {})) {
    const actualRows = actualTotals?.[key];
    if (actualRows !== expectedRows) {
      throw new BackendError("validation.mismatch", `${label} ${key} mapped ${actualRows ?? "missing"} row(s) but expected ${expectedRows}; refusing import success`, {
        key,
        actualRows,
        expectedRows,
      });
    }
  }
}

export function verifyConvexEnrichmentRun(expectedJobRows, verification) {
  const failures = [];
  if (!verification) failures.push("No Convex enrichment verification result returned.");
  if (verification && verification.importStatus !== "completed") failures.push("Convex enrichment import is not marked completed.");
  if (verification && verification.loadedJobRows !== expectedJobRows) {
    failures.push(`enrichment jobs loaded ${verification.loadedJobRows ?? "missing"} but expected ${expectedJobRows}.`);
  }

  return {
    ok: failures.length === 0,
    failures,
  };
}

export function verifyConvexWebsiteDiscoveryRun(expectedJobRows, verification) {
  const failures = [];
  if (!verification) failures.push("No Convex website discovery verification result returned.");
  if (verification && verification.importStatus !== "completed") failures.push("Convex website discovery import is not marked completed.");
  if (verification && verification.loadedJobRows !== expectedJobRows) {
    failures.push(`website discovery jobs loaded ${verification.loadedJobRows ?? "missing"} but expected ${expectedJobRows}.`);
  }

  return {
    ok: failures.length === 0,
    failures,
  };
}

export function verifyConvexWebsiteSearchRequestRun(expectedRows, verification) {
  const failures = [];
  if (!verification) failures.push("No Convex website search request verification result returned.");
  if (verification && verification.importStatus !== "completed") failures.push("Convex website search request import is not marked completed.");
  if (verification && verification.loadedRows !== expectedRows) {
    failures.push(`website search requests loaded ${verification.loadedRows ?? "missing"} but expected ${expectedRows}.`);
  }

  return {
    ok: failures.length === 0,
    failures,
  };
}

export function verifyConvexWebsiteCandidateRun(expectedRows, verification) {
  const failures = [];
  if (!verification) failures.push("No Convex website candidate verification result returned.");
  if (verification && verification.importStatus !== "completed") failures.push("Convex website candidate import is not marked completed.");
  if (verification && verification.loadedRows !== expectedRows) {
    failures.push(`website candidate rows loaded ${verification.loadedRows ?? "missing"} but expected ${expectedRows}.`);
  }

  return {
    ok: failures.length === 0,
    failures,
  };
}

export function verifyConvexWebsiteCorroborationRun(expectedRows, verification) {
  const failures = [];
  if (!verification) failures.push("No Convex website corroboration verification result returned.");
  if (verification && verification.importStatus !== "completed") failures.push("Convex website corroboration import is not marked completed.");
  if (verification && verification.loadedRows !== expectedRows) {
    failures.push(`website corroboration rows loaded ${verification.loadedRows ?? "missing"} but expected ${expectedRows}.`);
  }

  return {
    ok: failures.length === 0,
    failures,
  };
}

export function verifyConvexWebsiteUpdateProposalRun(expectedRows, verification) {
  const failures = [];
  if (!verification) failures.push("No Convex website update proposal verification result returned.");
  if (verification && verification.importStatus !== "completed") failures.push("Convex website update proposal import is not marked completed.");
  if (verification && verification.loadedRows !== expectedRows) {
    failures.push(`website update proposal rows loaded ${verification.loadedRows ?? "missing"} but expected ${expectedRows}.`);
  }

  return {
    ok: failures.length === 0,
    failures,
  };
}

export function verifyConvexDetailedListRun(expectedRows, verification) {
  const failures = [];
  if (!verification) failures.push("No Convex detailed builder list verification result returned.");
  if (verification && verification.importStatus !== "completed") failures.push("Convex detailed builder list import is not marked completed.");
  if (verification && verification.loadedRows !== expectedRows) {
    failures.push(`detailed builder rows loaded ${verification.loadedRows ?? "missing"} but expected ${expectedRows}.`);
  }

  return {
    ok: failures.length === 0,
    failures,
  };
}

export function verifyConvexAbnEvidenceRun(expectedRows, verification, label = "ABN evidence") {
  const failures = [];
  if (!verification) failures.push(`No Convex ${label} verification result returned.`);
  if (verification && verification.importStatus !== "completed") failures.push(`Convex ${label} import is not marked completed.`);
  if (verification && verification.loadedRows !== expectedRows) {
    failures.push(`${label} rows loaded ${verification.loadedRows ?? "missing"} but expected ${expectedRows}.`);
  }
  return { ok: failures.length === 0, failures };
}

export function verifyConvexProductionReadinessRun(expectedRun, verification) {
  const failures = [];
  if (!expectedRun) failures.push("No local production readiness run was provided.");
  if (!verification) failures.push("No Convex production readiness verification result returned.");
  if (!expectedRun || !verification) return { ok: false, failures };

  if (verification.importStatus !== "completed") failures.push("Convex production readiness import is not marked completed.");
  if (verification.readinessStatus !== expectedRun.status) {
    failures.push(`production readiness status ${verification.readinessStatus ?? "missing"} but expected ${expectedRun.status}.`);
  }
  compareNumber(failures, "production readiness builders", verification.summary?.builders, expectedRun.builders);
  compareNumber(failures, "production readiness licences", verification.summary?.licences, expectedRun.licences);
  compareNumber(failures, "production readiness detailedListRows", verification.summary?.detailedListRows, expectedRun.detailedListRows);
  compareNumber(failures, "production readiness enrichmentJobs", verification.summary?.enrichmentJobs, expectedRun.enrichmentJobs);
  compareNumber(failures, "production readiness websiteDiscoveryJobs", verification.summary?.websiteDiscoveryJobs, expectedRun.websiteDiscoveryJobs);
  compareNumber(failures, "production readiness websiteSearchRequests", verification.summary?.websiteSearchRequests ?? 0, expectedRun.websiteSearchRequests ?? 0);
  compareNumber(failures, "production readiness websiteCandidateRows", verification.summary?.websiteCandidateRows, expectedRun.websiteCandidateRows);
  compareNumber(failures, "production readiness websiteCorroborationRows", verification.summary?.websiteCorroborationRows ?? 0, expectedRun.websiteCorroborationRows ?? 0);
  compareNumber(failures, "production readiness websiteCorroboratedRows", verification.summary?.websiteCorroboratedRows ?? 0, expectedRun.websiteCorroboratedRows ?? 0);
  compareNumber(failures, "production readiness websiteUpdateProposalRows", verification.summary?.websiteUpdateProposalRows ?? 0, expectedRun.websiteUpdateProposalRows ?? 0);
  compareNumber(failures, "production readiness websiteUpdateProposedRows", verification.summary?.websiteUpdateProposedRows ?? 0, expectedRun.websiteUpdateProposedRows ?? 0);
  if ((verification.summary?.detailedListAuditStatus ?? "missing") !== (expectedRun.detailedListAuditStatus ?? "missing")) {
    failures.push(
      `production readiness detailedListAuditStatus ${verification.summary?.detailedListAuditStatus ?? "missing"} but expected ${expectedRun.detailedListAuditStatus ?? "missing"}.`
    );
  }
  compareNumber(
    failures,
    "production readiness detailedListAuditHardFailures",
    verification.summary?.detailedListAuditHardFailures ?? 0,
    expectedRun.detailedListAuditHardFailures ?? 0
  );
  compareNumber(failures, "production readiness sourceAccessRequestRows", verification.summary?.sourceAccessRequestRows ?? 0, expectedRun.sourceAccessRequestRows ?? 0);
  compareNumber(failures, "production readiness duplicateReviewRows", verification.summary?.duplicateReviewRows ?? 0, expectedRun.duplicateReviewRows ?? 0);
  compareNumber(failures, "production readiness abnLookupRows", verification.summary?.abnLookupRows, expectedRun.abnLookupRows);
  compareNumber(failures, "production readiness blockerCount", verification.blockerCount, expectedRun.blockerCount);
  compareStringArray(failures, "production readiness imported states", verification.summary?.importedStates, expectedRun.importedStates);
  compareStringArray(failures, "production readiness pending states", verification.summary?.pendingStates, expectedRun.pendingStates);

  const expectedBlockerIds = parseJsonArray(expectedRun.blockersJson).map((blocker) => blocker.blockerId).filter(Boolean);
  const actualBlockerIds = (verification.blockers ?? []).map((blocker) => blocker.blockerId).filter(Boolean);
  compareStringArray(failures, "production readiness blockers", actualBlockerIds, expectedBlockerIds);

  const expectedFailedChecks = parseJsonArray(expectedRun.checksJson)
    .filter((check) => check.ok === false)
    .map((check) => check.checkId)
    .filter(Boolean);
  const actualFailedChecks = (verification.checks ?? [])
    .filter((check) => check.ok === false)
    .map((check) => check.checkId)
    .filter(Boolean);
  compareStringArray(failures, "production readiness failed checks", actualFailedChecks, expectedFailedChecks);

  return { ok: failures.length === 0, failures };
}

export function verifyConvexImportRun(expectedTotals, verification) {
  const failures = [];
  if (!verification) failures.push("No Convex import verification result returned.");
  if (verification && verification.importStatus !== "completed") failures.push("Convex import is not marked completed.");
  if (verification && !verification.sourceAccessReportPresent) failures.push("Convex source access report is missing.");
  if (verification && !verification.sourceAccessRecheckPresent) failures.push("Convex source access recheck is missing.");
  for (const [key, expected] of Object.entries(expectedTotals)) {
    const loaded = verification?.loadedTotals?.[key];
    if (loaded !== expected) failures.push(`${key} loaded ${loaded ?? "missing"} but expected ${expected}.`);
  }

  return {
    ok: failures.length === 0,
    failures,
  };
}

export function verifyConvexCoverageStatus(expectedCoverage, verification) {
  const failures = [];
  if (!expectedCoverage) failures.push("No local builder coverage status was provided.");
  if (!verification) failures.push("No Convex builder coverage status returned.");
  if (!expectedCoverage || !verification) return { ok: false, failures };

  compareNumber(failures, "builders", verification.totals?.builders, expectedCoverage.totals?.builders);
  compareNumber(failures, "licences", verification.totals?.licences, expectedCoverage.totals?.licences);
  compareNumber(failures, "memoryCards", verification.totals?.memoryCards, expectedCoverage.totals?.memoryCards);
  compareNumber(failures, "searchFacets", verification.totals?.searchFacets, expectedCoverage.totals?.searchFacets);
  compareNumber(failures, "duplicateReviews", verification.totals?.duplicateReviews, expectedCoverage.totals?.duplicateReviews);

  compareStringArray(failures, "imported states", verification.coverage?.importedStates, expectedCoverage.coverage?.importedStates);
  compareStringArray(failures, "pending states", verification.coverage?.pendingStates, expectedCoverage.coverage?.pendingStates);

  for (const state of expectedCoverage.importedStates ?? []) {
    const observed = (verification.importedStates ?? []).find((item) => item.state === state.state);
    if (!observed) {
      failures.push(`Imported state ${state.state} is missing from Convex coverage.`);
      continue;
    }
    compareNumber(failures, `${state.state} builders`, observed.builders, state.builders);
    compareNumber(failures, `${state.state} licences`, observed.licences, state.licences);
  }

  for (const state of expectedCoverage.pendingStates ?? []) {
    const observed = (verification.pendingStates ?? []).find((item) => item.state === state.state);
    if (!observed) {
      failures.push(`Pending state ${state.state} is missing from Convex coverage.`);
      continue;
    }
    if ((observed.importDecision ?? null) !== (state.importDecision ?? null)) {
      failures.push(`Pending state ${state.state} importDecision ${observed.importDecision ?? "missing"} but expected ${state.importDecision ?? "missing"}.`);
    }
    if ((observed.observedAccessStatus ?? null) !== (state.observedAccessStatus ?? null)) {
      failures.push(
        `Pending state ${state.state} observedAccessStatus ${observed.observedAccessStatus ?? "missing"} but expected ${state.observedAccessStatus ?? "missing"}.`
      );
    }
  }

  if (!verification.sourceAccessGeneratedAt) failures.push("Convex coverage is missing sourceAccessGeneratedAt.");
  if ((expectedCoverage.coverage?.pendingStates?.length ?? 0) > 0 && !verification.sourceAccessLastCheckedAt) {
    failures.push("Convex coverage is missing sourceAccessLastCheckedAt for pending states.");
  }

  return {
    ok: failures.length === 0,
    failures,
  };
}

export function toConvexSourceAccessReport(report, importId) {
  return {
    importId,
    generatedAt: report.generatedAt,
    importedStates: report.importedStates ?? [],
    pendingStates: report.pendingStates ?? [],
    importedSourcesJson: JSON.stringify(report.importedSources ?? []),
    pendingSourcesJson: JSON.stringify(report.pendingSources ?? []),
    rejectedCandidatesJson: JSON.stringify(report.rejectedCandidates ?? []),
    limitations: report.limitations ?? [],
  };
}

export function toConvexBuilder(builder) {
  return stripUndefined({
    externalId: builder.id,
    name: builder.name,
    normalizedName: normalizeText(builder.name),
    tradingNames: builder.tradingNames ?? [],
    websiteUrl: builder.websiteUrl,
    abn: builder.abn,
    acn: builder.acn,
    states: builder.states ?? [],
    primaryState: builder.states?.[0] ?? "unknown",
    serviceRegions: builder.serviceRegions ?? [],
    builderType: builder.builderType ?? "unknown",
    homeTypes: builder.homeTypes ?? [],
    priceTier: builder.priceTier ?? "unknown",
    priceEvidence: builder.priceEvidence,
    status: builder.status ?? "unverified",
    evidenceQuality: normalizeEvidenceQuality(builder.evidenceQuality),
    sourceIds: builder.sourceIds ?? [],
    addresses: builder.addresses ?? [],
    lastEnrichedAt: builder.lastEnrichedAt,
    artifactUpdatedAt: builder.lastEnrichedAt,
  });
}

export function toConvexLicence(licence) {
  return stripUndefined({
    externalId: licence.id,
    builderExternalId: licence.builderId,
    source: licence.source,
    sourceId: licence.sourceId,
    state: licence.state,
    licenceNumber: licence.licenceNumber,
    licenceClass: licence.licenceClass,
    licenceType: licence.licenceType,
    status: licence.status,
    restrictions: licence.restrictions ?? [],
    rawSourceUrl: licence.rawSourceUrl,
    lastCheckedAt: licence.lastCheckedAt,
    confidence: licence.confidence ?? 0,
    address: licence.address,
    postcode: licence.postcode,
    issueDate: licence.issueDate,
    expiryDate: licence.expiryDate,
    financialCategory: licence.financialCategory,
    licenceGrade: licence.licenceGrade,
    firstNominatedSupervisor: licence.firstNominatedSupervisor,
    formerRegistrationNumber: licence.formerRegistrationNumber,
  });
}

export function toConvexMemoryCard(memoryCard) {
  return {
    externalId: memoryCard.id,
    builderExternalId: memoryCard.builderId,
    markdown: memoryCard.markdown,
    searchableText: memoryCard.searchableText,
    sourceIds: memoryCard.sourceIds ?? [],
    lastGeneratedAt: memoryCard.lastGeneratedAt,
    confidence: memoryCard.confidence ?? 0,
    ragNamespace: memoryCard.ragNamespace ?? "builders",
    evidenceQuality: normalizeEvidenceQuality(memoryCard.evidenceQuality),
  };
}

export function toConvexSearchFacets(searchRow) {
  const states = searchRow.states?.length ? searchRow.states : ["unknown"];
  const postcodes = searchRow.postcodes?.length ? searchRow.postcodes : [UNKNOWN_POSTCODE_FACET];
  const facets = [];

  for (const state of states) {
    for (const postcode of postcodes) {
      facets.push({
        facetKey: `${searchRow.builderId}:${state}:${postcode}`,
        builderExternalId: searchRow.builderId,
        name: searchRow.name,
        searchableText: searchRow.searchableText,
        state,
        postcode,
        sources: searchRow.sources ?? [],
        licenceClasses: searchRow.licenceClasses ?? [],
        licenceNumbers: searchRow.licenceNumbers ?? [],
        confidence: searchRow.confidence ?? 0,
        evidenceQuality: normalizeEvidenceQuality(searchRow.evidenceQuality),
        memoryCardExternalId: searchRow.memoryCardId,
      });
    }
  }

  return facets;
}

export function toConvexDuplicateReview(row) {
  assertReviewOnlyDuplicateReview(row, "duplicate review");
  return {
    externalId: row.id,
    normalizedName: row.normalizedName,
    displayNames: row.displayNames ?? [],
    reviewReason: row.reviewReason,
    reviewOnly: Boolean(row.reviewOnly),
    autoMerge: Boolean(row.autoMerge),
    confidence: row.confidence,
    builderCount: row.builderCount ?? 0,
    states: row.states ?? [],
    builderIds: row.builderIds ?? [],
    sourceIds: row.sourceIds ?? [],
    abns: row.businessNumbers?.abns ?? [],
    acns: row.businessNumbers?.acns ?? [],
    licenceCount: row.licences?.length ?? row.licenceCount ?? 0,
    notes: row.notes ?? [],
  };
}

function assertReviewOnlyDuplicateReview(row, label) {
  if (row?.reviewOnly !== true) {
    throw new BackendError("validation.invalid", `${label} must be reviewOnly before Convex import`, {
      reviewOnly: row?.reviewOnly,
    });
  }
  if (row?.autoMerge !== false) {
    throw new BackendError("validation.invalid", `${label} must have autoMerge false before Convex import`, {
      autoMerge: row?.autoMerge,
    });
  }
}

export function toConvexEnrichmentJob(row) {
  const gaps = row.gaps ?? [];
  const suggestedJobs = row.suggestedJobs ?? [];
  return {
    externalId: row.jobId,
    builderExternalId: row.builderId,
    name: row.name,
    states: row.states ?? [],
    primaryState: row.states?.[0] ?? "unknown",
    sourceIds: row.sourceIds ?? [],
    sourceManifestGeneratedAt: row.sourceManifestGeneratedAt,
    generatedAt: row.generatedAt,
    gaps,
    gapKey: gaps[0] ?? "none",
    hasBusinessIdentityGap: gaps.includes("business_identity"),
    hasWebsiteDiscoveryGap: gaps.includes("website_discovery"),
    hasWebsiteEnrichmentGap: gaps.includes("website_enrichment"),
    hasServiceRegionGap: gaps.includes("service_region"),
    hasAddressGap: gaps.includes("address"),
    suggestedJobs,
    suggestedJobKey: suggestedJobs[0] ?? "none",
    hasAbnLookupIdentityMatchJob: suggestedJobs.includes("abn_lookup_identity_match"),
    hasOfficialWebsiteDiscoveryJob: suggestedJobs.includes("official_website_discovery"),
    hasWebsiteSummaryRefreshJob: suggestedJobs.includes("website_summary_refresh"),
    hasServiceRegionExtractionJob: suggestedJobs.includes("service_region_extraction"),
    hasAddressNormalisationJob: suggestedJobs.includes("address_normalisation"),
    priorityScore: row.priorityScore ?? 0,
    reasons: row.reasons ?? [],
    licenceCount: row.evidence?.licenceCount ?? 0,
    licenceClasses: row.evidence?.licenceClasses ?? [],
    licenceNumbers: row.evidence?.licenceNumbers ?? [],
    hasAbn: Boolean(row.evidence?.hasAbn),
    hasAcn: Boolean(row.evidence?.hasAcn),
    hasWebsite: Boolean(row.evidence?.hasWebsite),
    hasServiceRegions: Boolean(row.evidence?.hasServiceRegions),
    hasAddress: Boolean(row.evidence?.hasAddress),
    evidenceQuality: normalizeEvidenceQuality(row.evidence?.evidenceQuality),
    constraints: row.constraints ?? [],
  };
}

export function toConvexWebsiteDiscoveryJob(row) {
  return {
    externalId: row.discoveryJobId,
    builderExternalId: row.builderId,
    enrichmentJobExternalId: row.enrichmentJobId,
    name: row.name,
    states: row.states ?? [],
    primaryState: row.states?.[0] ?? "unknown",
    sourceIds: row.sourceIds ?? [],
    sourceManifestGeneratedAt: row.sourceManifestGeneratedAt,
    generatedAt: row.generatedAt,
    searchQueries: row.searchQueries ?? [],
    searchQueryCount: row.searchQueries?.length ?? 0,
    maxResultsPerQuery: row.maxResultsPerQuery ?? 10,
    excludedHosts: row.excludedHosts ?? [],
    priorityScore: row.priorityScore ?? 0,
    licenceCount: row.evidence?.licenceCount ?? 0,
    licenceClasses: row.evidence?.licenceClasses ?? [],
    licenceNumbers: row.evidence?.licenceNumbers ?? [],
    hasWebsite: Boolean(row.evidence?.hasWebsite),
    evidenceQuality: normalizeEvidenceQuality(row.evidence?.evidenceQuality),
    constraints: row.constraints ?? [],
  };
}

export function toConvexWebsiteSearchRequest(row) {
  return {
    externalId: row.requestId,
    discoveryJobExternalId: row.discoveryJobId,
    builderExternalId: row.builderId,
    enrichmentJobExternalId: row.enrichmentJobId,
    builderName: row.builderName,
    states: row.states ?? [],
    primaryState: row.states?.[0] ?? "unknown",
    sourceIds: row.sourceIds ?? [],
    query: row.query,
    maxResults: row.maxResults ?? 10,
    excludedHosts: row.excludedHosts ?? [],
    licenceCount: row.evidence?.licenceCount ?? 0,
    licenceNumbers: row.evidence?.licenceNumbers ?? [],
    licenceClasses: row.evidence?.licenceClasses ?? [],
    hasWebsite: Boolean(row.evidence?.hasWebsite),
    evidenceQuality: normalizeEvidenceQuality(row.evidence?.evidenceQuality),
    requestStatus: row.requestStatus ?? "pending_search_provider",
    constraints: row.constraints ?? [],
  };
}

export function toConvexWebsiteCandidate(row) {
  assertReviewOnlyEvidence(row, "website candidate");
  return stripUndefined({
    externalId: row.candidateId,
    builderExternalId: row.builderId,
    discoveryJobExternalId: row.discoveryJobId,
    provider: row.provider ?? "unknown",
    query: row.query ?? undefined,
    rank: Number.isFinite(row.rank) ? row.rank : undefined,
    builderName: row.builderName ?? row.name ?? "",
    states: row.states ?? [],
    primaryState: row.states?.[0] ?? "unknown",
    sourceIds: row.sourceIds ?? [],
    licenceNumbers: row.licenceNumbers ?? [],
    licenceClasses: row.licenceClasses ?? [],
    url: row.url,
    host: row.host,
    title: row.title,
    snippet: row.snippet,
    candidateStatus: row.candidateStatus ?? "review_required",
    reviewOnly: row.reviewOnly === true,
    autoApply: row.autoApply === true,
    score: row.score ?? 0,
    matchedNameTerms: row.matchedNameTerms ?? [],
    exclusionReason: row.exclusionReason,
    evidenceJson: JSON.stringify(row.evidence ?? {}),
    constraints: row.constraints ?? [],
  });
}

export function toConvexWebsiteCorroboration(row) {
  assertReviewOnlyEvidence(row, "website corroboration");
  return stripUndefined({
    externalId: row.corroborationId,
    candidateExternalId: row.candidateId,
    builderExternalId: row.builderId,
    discoveryJobExternalId: row.discoveryJobId,
    builderName: row.builderName ?? "",
    states: row.states ?? [],
    primaryState: row.states?.[0] ?? "unknown",
    licenceNumbers: row.licenceNumbers ?? [],
    licenceClasses: row.licenceClasses ?? [],
    url: row.url,
    host: row.host,
    provider: row.provider ?? "unknown",
    searchRank: Number.isFinite(row.searchRank) ? row.searchRank : undefined,
    fetchStatus: row.fetchStatus ?? "unknown",
    httpStatus: Number.isFinite(row.httpStatus) ? row.httpStatus : undefined,
    contentType: row.contentType ?? undefined,
    corroborationStatus: row.corroborationStatus ?? "review_required",
    reviewOnly: row.reviewOnly === true,
    autoApply: row.autoApply === true,
    score: row.score ?? 0,
    matchedNameTerms: row.matchedNameTerms ?? [],
    matchedLicenceNumbers: row.matchedLicenceNumbers ?? [],
    matchedStates: row.matchedStates ?? [],
    pageTextHash: row.pageTextHash ?? "",
    pageTextSample: row.pageTextSample ?? undefined,
    constraints: row.constraints ?? [],
  });
}

export function toConvexWebsiteUpdateProposal(row) {
  assertReviewOnlyEvidence(row, "website update proposal");
  return stripUndefined({
    externalId: row.proposalId ?? `builder-website-update-proposal:${stableHash([row.builderId, row.corroborationId, row.generatedAt, row.proposalStatus])}`,
    source: row.source,
    corroborationExternalId: row.corroborationId ?? undefined,
    candidateExternalId: row.candidateId ?? undefined,
    builderExternalId: row.builderId ?? undefined,
    discoveryJobExternalId: row.discoveryJobId ?? undefined,
    builderName: row.builderName ?? undefined,
    generatedAt: row.generatedAt,
    proposalStatus: row.proposalStatus,
    proposalId: row.proposalId,
    reason: row.reason,
    confidence: row.confidence,
    url: row.url ?? undefined,
    host: row.host ?? undefined,
    reviewOnly: row.reviewOnly === true,
    autoApply: row.autoApply === true,
    proposedWebsiteUrl: row.proposedUpdates?.websiteUrl,
    proposedUpdatesJson: JSON.stringify(row.proposedUpdates ?? {}),
    evidenceJson: JSON.stringify(row.evidence ?? {}),
    limitations: row.limitations ?? [],
    constraints: row.constraints ?? [],
  });
}

export function toConvexDetailedListRow(row) {
  return stripUndefined({
    externalId: row.builderId,
    name: row.name,
    normalizedName: normalizeText(row.name),
    tradingNames: row.tradingNames ?? [],
    states: row.states ?? [],
    primaryState: row.primaryState ?? row.states?.[0] ?? "unknown",
    status: row.status ?? "unknown",
    builderType: row.builderType ?? "unknown",
    homeTypes: row.homeTypes ?? [],
    serviceRegions: row.serviceRegions ?? [],
    postcodes: row.postcodes ?? [],
    addresses: row.addresses ?? [],
    websiteUrl: row.websiteUrl ?? undefined,
    abn: row.abn ?? undefined,
    acn: row.acn ?? undefined,
    licenceCount: row.licenceCount ?? 0,
    licenceNumbers: row.licenceNumbers ?? [],
    licenceClasses: row.licenceClasses ?? [],
    licenceTypes: row.licenceTypes ?? [],
    licenceStatuses: row.licenceStatuses ?? [],
    licenceSources: row.licenceSources ?? [],
    sourceIds: row.sourceIds ?? [],
    rawSourceUrls: row.rawSourceUrls ?? [],
    lastCheckedAt: row.lastCheckedAt ?? undefined,
    confidence: row.confidence ?? 0,
    officialLicenceRecord: Boolean(row.officialLicenceRecord),
    businessIdentityMatched: Boolean(row.businessIdentityMatched),
    websiteEnriched: Boolean(row.websiteEnriched),
    memoryCardExternalId: row.memoryCardId ?? undefined,
    ragNamespace: row.ragNamespace ?? "builders",
    limitations: row.limitations ?? [],
    evidenceNotes: row.evidenceNotes ?? [],
    licencesJson: JSON.stringify(row.licences ?? []),
  });
}

export function toConvexAbnLookupResult(row) {
  const candidateCount = row.candidates?.length ?? 0;
  const exactMatchCount = row.exactMatches?.length ?? 0;
  return stripUndefined({
    externalId: `builder-abn-lookup-result:${stableHash([row.builderId, row.jobId, row.checkedAt, row.status])}`,
    status: row.status ?? "unknown",
    checkedAt: row.checkedAt,
    source: row.source,
    sourceUrl: row.sourceUrl,
    builderExternalId: row.builderId ?? undefined,
    jobExternalId: row.jobId ?? undefined,
    queryName: row.queryName,
    responseMessage: row.responseMessage,
    candidateCount,
    exactMatchCount,
    candidatesJson: JSON.stringify(row.candidates ?? []),
    exactMatchesJson: JSON.stringify(row.exactMatches ?? []),
    reason: row.reason,
    limitations: row.limitations ?? [],
  });
}

export function toConvexAbnMergeProposal(row) {
  assertReviewOnlyEvidence(row, "ABN merge proposal");
  return stripUndefined({
    externalId: row.proposalId ?? `builder-abn-merge-proposal:${stableHash([row.builderId, row.jobId, row.generatedAt, row.proposalStatus])}`,
    source: row.source,
    sourceUrl: row.sourceUrl,
    builderExternalId: row.builderId ?? undefined,
    jobExternalId: row.jobId ?? undefined,
    queryName: row.queryName ?? undefined,
    checkedAt: row.checkedAt ?? undefined,
    generatedAt: row.generatedAt,
    proposalStatus: row.proposalStatus,
    proposalId: row.proposalId,
    reason: row.reason,
    confidence: row.confidence,
    reviewOnly: row.reviewOnly === true,
    autoApply: row.autoApply === true,
    proposedAbn: row.proposedUpdates?.abn,
    proposedAcn: row.proposedUpdates?.acn,
    proposedUpdatesJson: JSON.stringify(row.proposedUpdates ?? {}),
    evidenceJson: JSON.stringify(row.evidence ?? {}),
    limitations: row.limitations ?? [],
    constraints: row.constraints ?? [],
  });
}

function assertReviewOnlyEvidence(row, label) {
  if (row?.reviewOnly !== true) {
    throw new BackendError("validation.invalid", `${label} must be reviewOnly before Convex import`, {
      reviewOnly: row?.reviewOnly,
    });
  }
  if (row?.autoApply !== false) {
    throw new BackendError("validation.invalid", `${label} must have autoApply false before Convex import`, {
      autoApply: row?.autoApply,
    });
  }
}

export async function* readNdjsonMappedBatches(filepath, mapper, batchSize = DEFAULT_CONVEX_BUILDER_BATCH_SIZE) {
  const batch = [];
  for await (const row of readNdjson(filepath)) {
    const mapped = mapper(row);
    const values = Array.isArray(mapped) ? mapped : [mapped];
    for (const value of values.filter(Boolean)) {
      batch.push(value);
      if (batch.length >= batchSize) {
        yield batch.splice(0, batch.length);
      }
    }
  }
  if (batch.length) yield batch;
}

export function artifactPaths(dataDir = DEFAULT_BUILDER_DATA_DIR) {
  return {
    builders: path.join(dataDir, "builders.ndjson"),
    licences: path.join(dataDir, "builder-licences.ndjson"),
    memoryCards: path.join(dataDir, "builder-memory-cards.ndjson"),
    searchRows: path.join(dataDir, "builder-search-index.ndjson"),
    duplicateReviews: path.join(dataDir, "builder-duplicate-review.ndjson"),
    enrichmentJobs: path.join(dataDir, "builder-enrichment-jobs.ndjson"),
    websiteDiscoveryJobs: path.join(dataDir, "builder-website-discovery-jobs.ndjson"),
    websiteSearchRequests: path.join(dataDir, "builder-website-search-requests.ndjson"),
    websiteCandidates: path.join(dataDir, "builder-website-candidates.ndjson"),
    websiteCorroborations: path.join(dataDir, "builder-website-corroboration.ndjson"),
    websiteUpdateProposals: path.join(dataDir, "builder-website-update-proposals.ndjson"),
    detailedListRows: path.join(dataDir, "builder-detailed-list.ndjson"),
    abnLookupResults: path.join(dataDir, "builder-abn-lookup-results.ndjson"),
    abnMergeProposals: path.join(dataDir, "builder-abn-merge-proposals.ndjson"),
  };
}

function stableHash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 20);
}

function compareNumber(failures, label, observed, expected) {
  if (observed !== expected) failures.push(`${label} ${observed ?? "missing"} but expected ${expected ?? "missing"}.`);
}

function compareStringArray(failures, label, observed, expected) {
  const observedList = [...(observed ?? [])].sort();
  const expectedList = [...(expected ?? [])].sort();
  if (JSON.stringify(observedList) !== JSON.stringify(expectedList)) {
    failures.push(`${label} ${observedList.join(",") || "missing"} but expected ${expectedList.join(",") || "missing"}.`);
  }
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toConvexGapCounts(value = {}) {
  return {
    businessIdentity: value.business_identity ?? 0,
    websiteDiscovery: value.website_discovery ?? 0,
    websiteEnrichment: value.website_enrichment ?? 0,
    serviceRegion: value.service_region ?? 0,
    address: value.address ?? 0,
  };
}

function toConvexSuggestedJobCounts(value = {}) {
  return {
    abnLookupIdentityMatch: value.abn_lookup_identity_match ?? 0,
    officialWebsiteDiscovery: value.official_website_discovery ?? 0,
    websiteSummaryRefresh: value.website_summary_refresh ?? 0,
    serviceRegionExtraction: value.service_region_extraction ?? 0,
    addressNormalisation: value.address_normalisation ?? 0,
  };
}

function normalizeEvidenceQuality(value = {}) {
  return {
    officialLicenceRecord: Boolean(value.officialLicenceRecord),
    businessIdentityMatched: Boolean(value.businessIdentityMatched),
    websiteEnriched: Boolean(value.websiteEnriched),
  };
}

function stripUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function requireSummaryFileSha256(summary, filename, label) {
  const sha256 = summary?.files?.[filename]?.sha256;
  if (!/^[a-f0-9]{64}$/.test(sha256 ?? "")) {
    throw new BackendError("validation.required", `${label} summary file metadata must include a SHA-256`, { filename });
  }
  return sha256;
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
