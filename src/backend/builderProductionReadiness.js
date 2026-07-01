import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_BUILDER_DATA_DIR, assertSafeBuilderArtifactFilename } from "./builderArtifacts.js";

export async function buildBuilderProductionReadinessReport(options = {}) {
  const dataDir = options.dataDir ?? DEFAULT_BUILDER_DATA_DIR;
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const [manifest, qualityReport, detailedListSummary, enrichmentSummary, websiteDiscoverySummary, sourceAccessReport, sourceAccessRecheck] =
    await Promise.all([
      readJson(path.join(dataDir, "manifest.json")),
      readJson(path.join(dataDir, "quality-report.json")),
      readJson(path.join(dataDir, "builder-detailed-list-summary.json")),
      readJson(path.join(dataDir, "builder-enrichment-summary.json")),
      readJson(path.join(dataDir, "builder-website-discovery-summary.json")),
      readJson(path.join(dataDir, "source-access-report.json")),
      readOptionalJson(path.join(dataDir, "source-access-recheck.json")),
    ]);
  const websiteCandidateSummary = await readOptionalJson(path.join(dataDir, "builder-website-candidates-summary.json"));
  const websiteCorroborationSummary = await readOptionalJson(path.join(dataDir, "builder-website-corroboration-summary.json"));
  const websiteSearchRequestsSummary = await readOptionalJson(path.join(dataDir, "builder-website-search-requests-summary.json"));
  const abnLookupSummary = await readOptionalJson(path.join(dataDir, "builder-abn-lookup-summary.json"));
  const abnMergeSummary = await readOptionalJson(path.join(dataDir, "builder-abn-merge-summary.json"));
  const websiteUpdateProposalSummary = await readOptionalJson(path.join(dataDir, "builder-website-update-proposals-summary.json"));
  const detailedListAudit = await readOptionalJson(path.join(dataDir, "builder-detailed-list-audit.json"));
  const sourceAccessRequests = await readOptionalJson(path.join(dataDir, "source-access-requests.json"));
  const duplicateReviewRows = await countOptionalNdjsonRows(path.join(dataDir, "builder-duplicate-review.ndjson"));

  return buildBuilderProductionReadinessReportFromArtifacts({
    generatedAt,
    manifest,
    qualityReport,
    detailedListSummary,
    enrichmentSummary,
    websiteDiscoverySummary,
    websiteSearchRequestsSummary,
    websiteCandidateSummary,
    websiteCorroborationSummary,
    websiteUpdateProposalSummary,
    detailedListAudit,
    sourceAccessRequests,
    duplicateReviewRows,
    abnLookupSummary,
    abnMergeSummary,
    sourceAccessReport,
    sourceAccessRecheck,
  });
}

export async function writeBuilderProductionReadinessReport(options = {}) {
  const dataDir = options.dataDir ?? DEFAULT_BUILDER_DATA_DIR;
  const outputFile = assertSafeBuilderArtifactFilename(options.outputFile ?? "builder-production-readiness.json", "builder production readiness output filename");
  const report = await buildBuilderProductionReadinessReport({ ...options, dataDir });
  const outputPath = path.join(dataDir, outputFile);
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

export function buildBuilderProductionReadinessReportFromArtifacts(artifacts) {
  const manifest = artifacts.manifest ?? {};
  const qualityReport = artifacts.qualityReport ?? {};
  const detailedListSummary = artifacts.detailedListSummary ?? {};
  const enrichmentSummary = artifacts.enrichmentSummary ?? {};
  const websiteDiscoverySummary = artifacts.websiteDiscoverySummary ?? {};
  const websiteSearchRequestsSummary = artifacts.websiteSearchRequestsSummary ?? null;
  const sourceAccessReport = artifacts.sourceAccessReport ?? {};
  const sourceAccessRecheck = artifacts.sourceAccessRecheck ?? null;
  const websiteCandidateSummary = artifacts.websiteCandidateSummary ?? null;
  const websiteCorroborationSummary = artifacts.websiteCorroborationSummary ?? null;
  const websiteUpdateProposalSummary = artifacts.websiteUpdateProposalSummary ?? null;
  const abnLookupSummary = artifacts.abnLookupSummary ?? null;
  const abnMergeSummary = artifacts.abnMergeSummary ?? null;
  const detailedListAudit = artifacts.detailedListAudit ?? null;
  const sourceAccessRequests = artifacts.sourceAccessRequests ?? null;

  const importedStates = manifest.importedStates ?? [];
  const pendingStates = manifest.pendingStates ?? [];
  const totalBuilders = manifest.totals?.builders ?? 0;
  const detailedBuilders = detailedListSummary.totals?.builders ?? 0;
  const detailedEvidenceCounts = detailedListSummary.evidenceCounts ?? {};
  const fieldCoverage = qualityReport.builderFieldCoverage ?? {};
  const enrichmentJobs = enrichmentSummary.totals?.jobRows ?? 0;
  const websiteDiscoveryJobs = websiteDiscoverySummary.totals?.writtenJobs ?? 0;
  const websiteSearchRequests = websiteSearchRequestsSummary?.totals?.writtenRequests ?? 0;
  const websiteCandidateRows = websiteCandidateSummary?.totals?.writtenCandidates ?? 0;
  const websiteCorroborationRows = websiteCorroborationSummary?.totals?.fetchedCandidates ?? 0;
  const websiteCorroboratedRows = websiteCorroborationSummary?.totals?.corroboratedCandidates ?? 0;
  const websiteUpdateProposalRows = websiteUpdateProposalSummary?.totals?.proposalRows ?? 0;
  const websiteUpdateProposedRows = websiteUpdateProposalSummary?.totals?.proposedRows ?? 0;
  const abnLookupRows = abnLookupSummary?.checkedJobs ?? 0;
  const abnMergeProposalRows = abnMergeSummary?.totals?.proposalRows ?? 0;
  const detailedListAuditStatus = detailedListAudit?.status ?? "missing";
  const detailedListAuditHardFailures = detailedListAudit?.hardFailures?.length ?? 0;
  const sourceAccessRequestRows = sourceAccessRequests?.requests?.length ?? 0;
  const duplicateReviewRows = manifest.files?.["builder-duplicate-review.ndjson"]?.rowCount ?? artifacts.duplicateReviewRows ?? 0;
  const sourceAccessRequestsReady =
    pendingStates.length === 0 ||
    (sourceAccessRequests?.status === "requests_ready" &&
      sourceAccessRequestRows === pendingStates.length &&
      (sourceAccessRequests.requests ?? []).every((request) => request.requestStatus === "ready_to_send"));

  const checks = [
    makeCheck("official_licence_artifacts", totalBuilders > 0, `${totalBuilders} builders imported from official licence evidence.`),
    makeCheck("detailed_list_matches_manifest", detailedBuilders === totalBuilders && totalBuilders > 0, `${detailedBuilders} detailed rows for ${totalBuilders} manifest builders.`),
    makeCheck(
      "detailed_list_audit_passed",
      detailedListAuditStatus === "passed" && detailedListAuditHardFailures === 0,
      detailedListAudit
        ? `Detailed builder list audit status ${detailedListAuditStatus}; ${detailedListAuditHardFailures} hard failures.`
        : "Detailed builder list audit artifact is missing."
    ),
    makeCheck("rag_memory_cards_match_builders", (qualityReport.memoryCardCoverage?.cardsMatchBuilders ?? false) === true, "RAG memory cards match builder count."),
    makeCheck("source_access_rechecked", Boolean(sourceAccessRecheck?.checkedAt), sourceAccessRecheck?.checkedAt ? `Pending sources rechecked at ${sourceAccessRecheck.checkedAt}.` : "Pending source recheck is missing."),
    makeCheck(
      "source_access_requests_ready",
      sourceAccessRequestsReady,
      sourceAccessRequests
        ? `${sourceAccessRequestRows} sanctioned-access request packets for ${pendingStates.length} pending states.`
        : "Source access request packets are missing for pending states."
    ),
    makeCheck("enrichment_queue_matches_builders", enrichmentJobs === totalBuilders && totalBuilders > 0, `${enrichmentJobs} enrichment jobs for ${totalBuilders} builders.`),
    makeCheck("website_discovery_queue_matches_builders", websiteDiscoveryJobs === totalBuilders && totalBuilders > 0, `${websiteDiscoveryJobs} website discovery jobs for ${totalBuilders} builders.`),
    makeCheck(
      "website_search_requests_prepared",
      websiteSearchRequests >= websiteDiscoveryJobs && websiteSearchRequests > 0,
      websiteSearchRequests > 0
        ? `${websiteSearchRequests} provider-ready website search requests prepared.`
        : "No provider-ready website search requests have been generated."
    ),
    makeCheck(
      "website_candidates_present",
      websiteCandidateRows > 0,
      websiteCandidateRows > 0
        ? `${websiteCandidateRows} review-only website candidates generated from supplied search evidence.`
        : "No website candidates have been generated from real search-provider evidence."
    ),
    makeCheck(
      "website_corroboration_present",
      websiteCorroborationRows > 0 && websiteCorroboratedRows > 0,
      websiteCorroborationRows > 0
        ? `${websiteCorroborationRows} fetched-page corroboration rows present; ${websiteCorroboratedRows} corroborated.`
        : "No fetched-page website corroboration evidence has been generated."
    ),
    makeCheck(
      "website_update_proposals_review_only",
      websiteCorroboratedRows === 0 || websiteUpdateProposedRows > 0,
      websiteUpdateProposalRows > 0
        ? `${websiteUpdateProposalRows} website update proposal rows generated for review; ${websiteUpdateProposedRows} proposed.`
        : "No website update proposals are present because corroborated website evidence is missing."
    ),
    makeCheck(
      "abn_lookup_evidence_present",
      abnLookupRows > 0,
      abnLookupRows > 0 ? `${abnLookupRows} ABN Lookup evidence rows present.` : "No credentialed ABN Lookup evidence rows are present."
    ),
    makeCheck(
      "abn_merge_proposals_review_only",
      abnMergeProposalRows > 0,
      abnMergeProposalRows > 0 ? `${abnMergeProposalRows} ABN merge proposal rows generated for review.` : "No ABN merge proposals are present because ABN evidence is missing."
    ),
    makeCheck(
      "all_jurisdictions_imported",
      pendingStates.length === 0,
      pendingStates.length === 0 ? "All configured states and territories are imported." : `Pending jurisdictions: ${pendingStates.join(", ")}.`
    ),
  ];

  const blockers = [
    ...pendingStates.map((state) => pendingStateBlocker(state, sourceAccessReport, sourceAccessRecheck)),
    ...(detailedListAuditStatus === "passed" && detailedListAuditHardFailures === 0
      ? []
      : [
          {
            blockerId: "detailed_list_audit_missing_or_failed",
            severity: "high",
            description: "The detailed builder list is missing a passing audit artifact.",
            requiredEvidence: "Generate builder-detailed-list-audit.json and resolve any hard failures before marking the corpus production-ready.",
          },
        ]),
    ...(sourceAccessRequestsReady
      ? []
      : [
          {
            blockerId: "source_access_requests_missing_or_not_ready",
            severity: "high",
            description: "Pending jurisdictions do not have a ready regulator access-request packet.",
            requiredEvidence: "Generate source-access-requests.json with a ready_to_send request for each pending jurisdiction.",
          },
        ]),
    ...(websiteCandidateRows > 0
      ? []
      : [
          {
            blockerId: "website_search_evidence_missing",
            severity: "high",
            description: "Website URLs remain unenriched because no real search-provider result file has been supplied.",
            requiredEvidence: "Run website candidate generation with a production search-provider result NDJSON file.",
          },
        ]),
    ...(websiteCandidateRows > 0 && websiteCorroborationRows === 0
      ? [
          {
            blockerId: "website_corroboration_evidence_missing",
            severity: "high",
            description: "Website candidate URLs have not been corroborated by fetched page content.",
            requiredEvidence: "Run website corroboration with --write after generating review-only website candidates.",
          },
        ]
      : []),
    ...(websiteCorroboratedRows > 0 && websiteUpdateProposedRows === 0
      ? [
          {
            blockerId: "website_update_proposals_missing",
            severity: "high",
            description: "Corroborated website evidence has not been converted into review-only website update proposals.",
            requiredEvidence: "Run website update proposal generation from the corroboration artifact.",
          },
        ]
      : []),
    ...(abnLookupRows > 0
      ? []
      : [
          {
            blockerId: "abn_lookup_guid_missing_or_not_run",
            severity: "high",
            description: "ABN/ACN enrichment remains incomplete because no credentialed ABN Lookup run has produced evidence artifacts.",
            requiredEvidence: "Set ABN_LOOKUP_GUID and run the ABN Lookup enrichment command with --write.",
          },
        ]),
  ].filter(Boolean);

  const status = checks.every((check) => check.ok) ? "production_ready" : "not_production_ready";

  return {
    schemaVersion: 1,
    generatedAt: artifacts.generatedAt,
    status,
    summary: {
      builders: totalBuilders,
      licences: manifest.totals?.licences ?? 0,
      importedStates,
      pendingStates,
      detailedListRows: detailedBuilders,
      memoryCards: qualityReport.totals?.memoryCards ?? 0,
      enrichmentJobs,
      websiteDiscoveryJobs,
      websiteSearchRequests,
      websiteCandidateRows,
      websiteCorroborationRows,
      websiteCorroboratedRows,
      websiteUpdateProposalRows,
      websiteUpdateProposedRows,
      detailedListAuditStatus,
      detailedListAuditHardFailures,
      sourceAccessRequestRows,
      duplicateReviewRows,
      abnLookupRows,
      abnMergeProposalRows,
    },
    evidenceCoverage: {
      officialLicenceRecord: countRatio(detailedEvidenceCounts.officialLicenceRecord ?? fieldCoverage.officialLicenceRecord?.count, totalBuilders),
      businessIdentityMatched: countRatio(detailedEvidenceCounts.businessIdentityMatched ?? fieldCoverage.businessIdentityMatched?.count, totalBuilders),
      websiteEnriched: countRatio(detailedEvidenceCounts.websiteEnriched ?? fieldCoverage.websiteEnriched?.count, totalBuilders),
      hasWebsiteUrl: countRatio(detailedEvidenceCounts.hasWebsiteUrl ?? fieldCoverage.websiteUrl?.count, totalBuilders),
      hasAddress: countRatio(detailedEvidenceCounts.hasAddress ?? fieldCoverage.addresses?.count, totalBuilders),
      hasServiceRegion: countRatio(detailedEvidenceCounts.hasServiceRegion ?? fieldCoverage.serviceRegions?.count, totalBuilders),
    },
    checks,
    blockers,
    limitations: [
      "Production readiness here means backend evidence completeness for Dwella builder memory, not a claim that every Australian builder is imported.",
      "Unknown website, ABN, price, capacity, insurance and quote behaviour fields remain unknown until evidence-backed enrichment runs produce source artifacts.",
      ...(manifest.limitations ?? []),
      ...(sourceAccessReport.limitations ?? []),
      ...(sourceAccessRecheck?.limitations ?? []),
    ],
  };
}

function makeCheck(checkId, ok, detail) {
  return {
    checkId,
    ok: Boolean(ok),
    detail,
  };
}

function pendingStateBlocker(state, sourceAccessReport, sourceAccessRecheck) {
  const pendingSource = (sourceAccessReport.pendingSources ?? []).find((source) => source.state === state);
  const recheck = (sourceAccessRecheck?.results ?? []).find((result) => result.state === state);
  return {
    blockerId: `pending_source_${state.toLowerCase()}`,
    severity: "high",
    state,
    sourceId: pendingSource?.sourceId ?? recheck?.sourceId ?? null,
    observedAccessStatus: recheck?.observedAccessStatus ?? pendingSource?.accessStatus ?? null,
    importDecision: recheck?.importDecision ?? pendingSource?.evidence?.[0]?.importDecision ?? "not_imported",
    description: pendingSource?.notes ?? "Pending jurisdiction has not been imported.",
    requiredEvidence: "Use a sanctioned bulk extract, documented API or written permission before importing this jurisdiction.",
  };
}

function countRatio(count, total) {
  const safeCount = Number(count) || 0;
  const safeTotal = Number(total) || 0;
  return {
    count: safeCount,
    total: safeTotal,
    ratio: safeTotal > 0 ? Number((safeCount / safeTotal).toFixed(4)) : 0,
  };
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

async function countOptionalNdjsonRows(filepath) {
  try {
    const contents = await readFile(filepath, "utf8");
    return contents
      .split("\n")
      .filter((line) => line.trim().length > 0).length;
  } catch (error) {
    if (error?.code === "ENOENT") return 0;
    throw error;
  }
}
