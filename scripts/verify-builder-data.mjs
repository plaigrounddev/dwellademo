#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import path from "node:path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data", "builders");
const manifest = await readJson("manifest.json");
const summary = await readJson("summary.json");
const qualityReport = await readJson("quality-report.json");
const sourceAccessReport = await readJson("source-access-report.json");
const sources = await readJson("sources.json");
const sourceAccessRequests = await readOptionalJson("source-access-requests.json");
const sourceAccessRecheck = await readOptionalJson("source-access-recheck.json");
const detailedListSummary = await readOptionalJson("builder-detailed-list-summary.json");
const detailedListAudit = await readOptionalJson("builder-detailed-list-audit.json");
const enrichmentSummary = await readOptionalJson("builder-enrichment-summary.json");
const locationEvidenceAudit = await readOptionalJson("builder-location-evidence-audit.json");
const websiteDiscoverySummary = await readOptionalJson("builder-website-discovery-summary.json");
const websiteSearchRequestsSummary = await readOptionalJson("builder-website-search-requests-summary.json");
const websiteSearchResultsSummary = await readOptionalJson("builder-website-search-results-summary.json");
const websiteCandidateSummary = await readOptionalJson("builder-website-candidates-summary.json");
const websiteCorroborationSummary = await readOptionalJson("builder-website-corroboration-summary.json");
const websiteUpdateProposalSummary = await readOptionalJson("builder-website-update-proposals-summary.json");
const abnLookupSummary = await readOptionalJson("builder-abn-lookup-summary.json");
const abnMergeSummary = await readOptionalJson("builder-abn-merge-summary.json");
const productionReadinessReport = await readOptionalJson("builder-production-readiness.json");

const failures = [];

assertEqual(manifest.schemaVersion, 1, "manifest schema version");
assertEqual(manifest.totals.builders, summary.totals.builders, "manifest builder total matches summary");
assertEqual(manifest.totals.licences, summary.totals.licences, "manifest licence total matches summary");
assertEqual(qualityReport.totals.builders, manifest.totals.builders, "quality report builder total matches manifest");
assertEqual(qualityReport.totals.licences, manifest.totals.licences, "quality report licence total matches manifest");
assertEqual(qualityReport.totals.memoryCards, manifest.files["builder-memory-cards.ndjson"]?.rowCount, "quality report memory-card total matches manifest");
assertEqual(qualityReport.memoryCardCoverage?.cardsMatchBuilders, true, "quality report memory cards match builders");
assertEqual(sourceAccessReport.schemaVersion, 1, "source access report schema version");
assertArraySetEqual(sourceAccessReport.importedStates, manifest.importedStates, "source access imported states match manifest");
assertArraySetEqual(sourceAccessReport.pendingStates, manifest.pendingStates, "source access pending states match manifest");
assertEqual(sourceAccessReport.importedSources?.length, manifest.sourceStats?.length, "source access imported source count matches manifest");
assertEqual(sourceAccessReport.pendingSources?.length, manifest.pendingStates?.length, "source access pending source count matches manifest");

if (manifest.pendingStates?.length) {
  if (!sourceAccessRequests) {
    failures.push("source access requests artifact is required while states remain pending");
  } else {
    assertEqual(sourceAccessRequests.schemaVersion, 1, "source access requests schema version");
    assertArraySetEqual(sourceAccessRequests.pendingStates, manifest.pendingStates, "source access requests pending states match manifest");
    assertEqual(sourceAccessRequests.requests?.length, manifest.pendingStates.length, "source access request count matches pending states");
    for (const request of sourceAccessRequests.requests ?? []) {
      if (!manifest.pendingStates.includes(request.state)) failures.push(`source access request ${request.sourceId}: state is not manifest-pending`);
      if (request.requestStatus !== "ready_to_send") failures.push(`source access request ${request.sourceId}: requestStatus must be ready_to_send`);
      if (!request.contact?.email && !request.contact?.url) failures.push(`source access request ${request.sourceId}: missing regulator contact path`);
      if (!request.requestedAccess?.fields?.includes("licence or registration number")) {
        failures.push(`source access request ${request.sourceId}: missing licence number requested field`);
      }
      if (!request.requestMessage?.subject?.includes(`${request.state} builder licence register extract`)) {
        failures.push(`source access request ${request.sourceId}: missing request message subject`);
      }
      if (!request.requestMessage?.body?.includes("public builder/building services licence records")) {
        failures.push(`source access request ${request.sourceId}: missing request message body`);
      }
      if (!request.requestMessage?.body?.includes("We will not bypass reCAPTCHA")) {
        failures.push(`source access request ${request.sourceId}: missing protected-form prohibition in request message`);
      }
      if (!request.prohibitedPaths?.some((item) => item.includes("reCAPTCHA"))) {
        failures.push(`source access request ${request.sourceId}: missing reCAPTCHA bypass prohibition`);
      }
      if (!request.validationBeforeImport?.length) failures.push(`source access request ${request.sourceId}: missing validation gates`);
    }
  }
}

if (sourceAccessRecheck) {
  assertEqual(sourceAccessRecheck.schemaVersion, 1, "source access recheck schema version");
  assertArraySetEqual(sourceAccessRecheck.pendingStates, manifest.pendingStates, "source access recheck pending states match manifest");
  assertEqual(sourceAccessRecheck.results?.length, manifest.pendingStates?.length, "source access recheck result count matches manifest pending states");
  for (const result of sourceAccessRecheck.results ?? []) {
    if (!manifest.pendingStates?.includes(result.state)) failures.push(`source access recheck ${result.sourceId}: state is not manifest-pending`);
    if (result.importDecision !== "not_imported") failures.push(`source access recheck ${result.sourceId}: importDecision must remain not_imported until a sanctioned source is implemented`);
    if (!result.probes?.length) failures.push(`source access recheck ${result.sourceId}: missing read-only probes`);
    for (const probe of result.probes ?? []) {
      assertEvidenceRecord(probe, `${result.sourceId} source recheck probe`);
    }
  }
}

if (detailedListSummary) {
  assertEqual(detailedListSummary.schemaVersion, 1, "builder detailed list summary schema version");
  assertEqual(detailedListSummary.sourceManifestGeneratedAt, manifest.generatedAt, "builder detailed list source manifest timestamp");
  assertEqual(detailedListSummary.totals?.sourceBuilders, manifest.totals.builders, "builder detailed list source builder count");
  assertEqual(detailedListSummary.totals?.sourceLicences, manifest.totals.licences, "builder detailed list source licence count");
  assertEqual(detailedListSummary.totals?.builders, manifest.totals.builders, "builder detailed list builder row count");
  const ndjsonFilename = safeArtifactFilename(detailedListSummary.outputFiles?.ndjson ?? "builder-detailed-list.ndjson", "builder detailed list NDJSON filename");
  const csvFilename = safeArtifactFilename(detailedListSummary.outputFiles?.csv ?? "builder-detailed-list.csv", "builder detailed list CSV filename");
  const ndjsonFile = detailedListSummary.files?.[ndjsonFilename];
  const csvFile = detailedListSummary.files?.[csvFilename];
  if (!ndjsonFile) {
    failures.push("builder detailed list summary: missing NDJSON file metadata");
  } else {
    const ndjsonPath = path.join(DATA_DIR, ndjsonFilename);
    const actualStat = await stat(ndjsonPath).catch(() => null);
    if (!actualStat) {
      failures.push(`${ndjsonFilename}: file is missing`);
    } else {
      const detailStats = await inspectDetailedBuilderRows(ndjsonPath);
      assertEqual(detailStats.rows, manifest.totals.builders, "builder detailed list NDJSON row count");
      assertEqual(detailStats.rows, ndjsonFile.rowCount, "builder detailed list NDJSON metadata row count");
      assertEqual(detailStats.licences, detailedListSummary.totals?.licences, "builder detailed list licence total");
      assertEqual(await sha256File(ndjsonPath), ndjsonFile.sha256, "builder detailed list NDJSON sha256");
    }
  }
  if (!csvFile) {
    failures.push("builder detailed list summary: missing CSV file metadata");
  } else {
    const csvPath = path.join(DATA_DIR, csvFilename);
    const actualStat = await stat(csvPath).catch(() => null);
    if (!actualStat) {
      failures.push(`${csvFilename}: file is missing`);
    } else {
      assertEqual(await sha256File(csvPath), csvFile.sha256, "builder detailed list CSV sha256");
    }
  }
}

if (detailedListAudit) {
  assertEqual(detailedListAudit.schemaVersion, 1, "builder detailed list audit schema version");
  if (!detailedListAudit.generatedAt) failures.push("builder detailed list audit: missing generatedAt");
  if (!detailedListAudit.inputFile) failures.push("builder detailed list audit: missing inputFile");
  assertEqual(detailedListAudit.sourceManifestGeneratedAt, manifest.generatedAt, "builder detailed list audit source manifest timestamp");
  assertEqual(detailedListAudit.sourceDetailedListGeneratedAt, detailedListSummary?.generatedAt, "builder detailed list audit detailed-list timestamp");
  assertEqual(detailedListAudit.totals?.rows, manifest.totals.builders, "builder detailed list audit row count");
  assertEqual(detailedListAudit.totals?.expectedBuilders, manifest.totals.builders, "builder detailed list audit expected builder count");
  assertEqual(detailedListAudit.totals?.licenceCount, manifest.totals.licences, "builder detailed list audit licence count");
  assertEqual(detailedListAudit.totals?.expectedLicences, manifest.totals.licences, "builder detailed list audit expected licence count");
  assertEqual(detailedListAudit.totals?.officialLicenceRows, manifest.totals.builders, "builder detailed list audit official licence rows");
  assertEqual(detailedListAudit.totals?.rowsMissingLicenceEvidence, 0, "builder detailed list audit missing licence evidence rows");
  assertEqual(detailedListAudit.totals?.rowsMissingSourceUrl, 0, "builder detailed list audit missing source URL rows");
  assertEqual(detailedListAudit.totals?.rowsMissingMemoryCard, 0, "builder detailed list audit missing memory card rows");
  assertEqual(detailedListAudit.status, "passed", "builder detailed list audit status");
  assertEqual(detailedListAudit.hardFailures?.length ?? 0, 0, "builder detailed list audit hard failures");
  const auditInputFilename = safeArtifactFilename(detailedListAudit.inputFile, "builder detailed list audit input filename");
  if (auditInputFilename) {
    const auditInputPath = path.join(DATA_DIR, auditInputFilename);
    const actualStat = await stat(auditInputPath).catch(() => null);
    if (!actualStat) {
      failures.push(`builder detailed list audit input ${auditInputFilename}: file is missing`);
    } else {
      assertEqual(await sha256File(auditInputPath), detailedListAudit.file?.sha256, "builder detailed list audit input sha256");
    }
    if (detailedListSummary) {
      assertEqual(detailedListAudit.file?.expectedSha256, detailedListSummary.files?.[auditInputFilename]?.sha256, "builder detailed list audit expected sha256");
    }
  }
}

if (enrichmentSummary) {
  assertEqual(enrichmentSummary.schemaVersion, 1, "builder enrichment summary schema version");
  assertEqual(enrichmentSummary.sourceManifestGeneratedAt, manifest.generatedAt, "builder enrichment summary source manifest timestamp");
  const jobsFile = enrichmentSummary.files?.["builder-enrichment-jobs.ndjson"];
  if (!jobsFile) {
    failures.push("builder enrichment summary: missing builder-enrichment-jobs.ndjson file metadata");
  } else {
    const jobsPath = path.join(DATA_DIR, "builder-enrichment-jobs.ndjson");
    const actualStat = await stat(jobsPath).catch(() => null);
    if (!actualStat) {
      failures.push("builder-enrichment-jobs.ndjson: file is missing");
    } else {
      assertEqual(await countNdjsonRows(jobsPath), jobsFile.rowCount, "builder enrichment job row count");
      assertEqual(await sha256File(jobsPath), jobsFile.sha256, "builder enrichment job sha256");
    }
  }
  assertEqual(enrichmentSummary.totals?.jobRows, jobsFile?.rowCount, "builder enrichment job total matches file row count");
  if (enrichmentSummary.totals?.jobRows > manifest.totals.builders) {
    failures.push("builder enrichment summary: jobRows cannot exceed imported builder count");
  }
  if (enrichmentSummary.gapCounts?.website_discovery !== enrichmentSummary.suggestedJobCounts?.official_website_discovery) {
    failures.push("builder enrichment summary: website discovery gap count must match suggested job count");
  }
}

if (locationEvidenceAudit) {
  assertEqual(locationEvidenceAudit.schemaVersion, 1, "builder location evidence audit schema version");
  assertEqual(locationEvidenceAudit.totals?.builders, manifest.totals.builders, "builder location evidence audit builder total");
  assertEqual(locationEvidenceAudit.totals?.licences, manifest.totals.licences, "builder location evidence audit licence total");
  if (enrichmentSummary) {
    assertEqual(locationEvidenceAudit.totals?.missingServiceRegions, enrichmentSummary.gapCounts?.service_region, "builder location evidence audit service-region gap count");
    assertEqual(locationEvidenceAudit.totals?.missingAddresses, enrichmentSummary.gapCounts?.address, "builder location evidence audit address gap count");
  }
  if ((locationEvidenceAudit.totals?.recoverableServiceRegionBuilders ?? 0) > (locationEvidenceAudit.totals?.missingServiceRegions ?? 0)) {
    failures.push("builder location evidence audit: recoverable service-region builders cannot exceed missing service-region builders");
  }
  if ((locationEvidenceAudit.totals?.recoverableAddressBuilders ?? 0) > (locationEvidenceAudit.totals?.missingAddresses ?? 0)) {
    failures.push("builder location evidence audit: recoverable address builders cannot exceed missing address builders");
  }
  if (!Array.isArray(locationEvidenceAudit.conclusions) || !locationEvidenceAudit.conclusions.some((item) => item.includes("Do not backfill"))) {
    failures.push("builder location evidence audit: missing no-backfill conclusion");
  }
}

if (websiteDiscoverySummary) {
  assertEqual(websiteDiscoverySummary.schemaVersion, 1, "builder website discovery summary schema version");
  assertEqual(websiteDiscoverySummary.sourceManifestGeneratedAt, manifest.generatedAt, "builder website discovery summary source manifest timestamp");
  if (!websiteDiscoverySummary.generatedAt) failures.push("builder website discovery summary: missing generatedAt");
  if (!websiteDiscoverySummary.inputFile) failures.push("builder website discovery summary: missing inputFile");
  safeArtifactFilename(websiteDiscoverySummary.inputFile, "builder website discovery input filename");
  const jobsFilename = safeArtifactFilename(websiteDiscoverySummary.outputFile ?? "builder-website-discovery-jobs.ndjson", "builder website discovery output filename");
  const jobsFile = websiteDiscoverySummary.files?.[jobsFilename];
  if (!jobsFile) {
    failures.push("builder website discovery summary: missing job file metadata");
  } else {
    const jobsPath = path.join(DATA_DIR, jobsFilename);
    const actualStat = await stat(jobsPath).catch(() => null);
    if (!actualStat) {
      failures.push(`${jobsFilename}: file is missing`);
    } else {
      const jobStats = await inspectWebsiteDiscoveryJobs(jobsPath);
      assertEqual(jobStats.rows, jobsFile.rowCount, "builder website discovery job row count");
      assertEqual(jobStats.rows, websiteDiscoverySummary.totals?.writtenJobs, "builder website discovery written job count");
      assertEqual(jobStats.searchQueries, websiteDiscoverySummary.totals?.searchQueries, "builder website discovery search query count");
      assertEqual(await sha256File(jobsPath), jobsFile.sha256, "builder website discovery job sha256");
    }
  }
  if ((websiteDiscoverySummary.totals?.writtenJobs ?? 0) > (enrichmentSummary?.totals?.jobRows ?? manifest.totals.builders)) {
    failures.push("builder website discovery summary: writtenJobs cannot exceed enrichment job count");
  }
}

if (websiteSearchRequestsSummary) {
  assertEqual(websiteSearchRequestsSummary.schemaVersion, 1, "builder website search request summary schema version");
  assertEqual(websiteSearchRequestsSummary.sourceManifestGeneratedAt, manifest.generatedAt, "builder website search request summary source manifest timestamp");
  if (!websiteSearchRequestsSummary.generatedAt) failures.push("builder website search request summary: missing generatedAt");
  if (!websiteSearchRequestsSummary.inputFile) failures.push("builder website search request summary: missing inputFile");
  if (!websiteSearchRequestsSummary.outputFile) failures.push("builder website search request summary: missing outputFile");
  safeArtifactFilename(websiteSearchRequestsSummary.inputFile, "builder website search request input filename");
  const requestsFilename = safeArtifactFilename(
    websiteSearchRequestsSummary.outputFile ?? "builder-website-search-requests.ndjson",
    "builder website search request output filename"
  );
  const requestsFile = websiteSearchRequestsSummary.files?.[requestsFilename];
  if (!requestsFile) {
    failures.push("builder website search request summary: missing request file metadata");
  } else {
    const requestsPath = path.join(DATA_DIR, requestsFilename);
    const actualStat = await stat(requestsPath).catch(() => null);
    if (!actualStat) {
      failures.push(`${requestsFilename}: file is missing`);
    } else {
      const requestStats = await inspectWebsiteSearchRequests(requestsPath);
      assertEqual(requestStats.rows, requestsFile.rowCount, "builder website search request row count");
      assertEqual(requestStats.rows, websiteSearchRequestsSummary.totals?.writtenRequests, "builder website search request written count");
      assertEqual(requestStats.pendingRows, requestStats.rows, "builder website search requests remain pending");
      assertEqual(await sha256File(requestsPath), requestsFile.sha256, "builder website search request sha256");
    }
  }
  if ((websiteSearchRequestsSummary.totals?.writtenRequests ?? 0) < (websiteDiscoverySummary?.totals?.writtenJobs ?? 0)) {
    failures.push("builder website search request summary: writtenRequests should be at least website discovery job count");
  }
}

if (websiteSearchResultsSummary) {
  assertEqual(websiteSearchResultsSummary.schemaVersion, 1, "builder website search result summary schema version");
  if (!websiteSearchResultsSummary.searchedAt) failures.push("builder website search result summary: missing searchedAt");
  if (!websiteSearchResultsSummary.provider) failures.push("builder website search result summary: missing provider");
  if (!websiteSearchResultsSummary.inputFile) failures.push("builder website search result summary: missing inputFile");
  if (!websiteSearchResultsSummary.outputFile) failures.push("builder website search result summary: missing outputFile");
  safeArtifactFilename(websiteSearchResultsSummary.inputFile, "builder website search result input filename");
  const resultsFilename = safeArtifactFilename(
    websiteSearchResultsSummary.outputFile ?? "builder-website-search-results.ndjson",
    "builder website search result output filename"
  );
  const resultsFile = websiteSearchResultsSummary.files?.[resultsFilename];
  if (!resultsFile) {
    failures.push("builder website search result summary: missing result file metadata");
  } else {
    const resultsPath = path.join(DATA_DIR, resultsFilename);
    const actualStat = await stat(resultsPath).catch(() => null);
    if (!actualStat) {
      failures.push(`${resultsFilename}: file is missing`);
    } else {
      const resultStats = await inspectWebsiteSearchResults(resultsPath);
      assertEqual(resultStats.rows, resultsFile.rowCount, "builder website search result row count");
      assertEqual(resultStats.rows, websiteSearchResultsSummary.totals?.searchedRequests, "builder website search result searched request count");
      assertEqual(resultStats.resultRows, websiteSearchResultsSummary.totals?.resultRows, "builder website search result item count");
      assertEqual(await sha256File(resultsPath), resultsFile.sha256, "builder website search result sha256");
    }
  }
  if ((websiteSearchResultsSummary.totals?.searchedRequests ?? 0) > (websiteSearchRequestsSummary?.totals?.writtenRequests ?? Number.POSITIVE_INFINITY)) {
    failures.push("builder website search result summary: searchedRequests cannot exceed generated search requests");
  }
}

if (websiteCandidateSummary) {
  assertEqual(websiteCandidateSummary.schemaVersion, 1, "builder website candidate summary schema version");
  if (!websiteCandidateSummary.generatedAt) failures.push("builder website candidate summary: missing generatedAt");
  if (!websiteCandidateSummary.inputFile) failures.push("builder website candidate summary: missing inputFile");
  if (!websiteCandidateSummary.jobsFile) failures.push("builder website candidate summary: missing jobsFile");
  if (!websiteCandidateSummary.outputFile) failures.push("builder website candidate summary: missing outputFile");
  safeArtifactFilename(websiteCandidateSummary.inputFile, "builder website candidate input filename");
  safeArtifactFilename(websiteCandidateSummary.jobsFile, "builder website candidate jobs filename");
  const candidatesFilename = safeArtifactFilename(websiteCandidateSummary.outputFile ?? "builder-website-candidates.ndjson", "builder website candidate output filename");
  const candidatesFile = websiteCandidateSummary.files?.[candidatesFilename];
  if (!candidatesFile) {
    failures.push("builder website candidate summary: missing candidate file metadata");
  } else {
    const candidatesPath = path.join(DATA_DIR, candidatesFilename);
    const actualStat = await stat(candidatesPath).catch(() => null);
    if (!actualStat) {
      failures.push(`${candidatesFilename}: file is missing`);
    } else {
      const candidateStats = await inspectWebsiteCandidates(candidatesPath);
      assertEqual(candidateStats.rows, candidatesFile.rowCount, "builder website candidate row count");
      assertEqual(candidateStats.rows, websiteCandidateSummary.totals?.writtenCandidates, "builder website candidate written count");
      assertEqual(await sha256File(candidatesPath), candidatesFile.sha256, "builder website candidate sha256");
    }
  }
}

if (websiteCorroborationSummary) {
  assertEqual(websiteCorroborationSummary.schemaVersion, 1, "builder website corroboration summary schema version");
  if (!websiteCorroborationSummary.fetchedAt) failures.push("builder website corroboration summary: missing fetchedAt");
  if (!websiteCorroborationSummary.inputFile) failures.push("builder website corroboration summary: missing inputFile");
  if (!websiteCorroborationSummary.outputFile) failures.push("builder website corroboration summary: missing outputFile");
  safeArtifactFilename(websiteCorroborationSummary.inputFile, "builder website corroboration input filename");
  const corroborationFilename = safeArtifactFilename(
    websiteCorroborationSummary.outputFile ?? "builder-website-corroboration.ndjson",
    "builder website corroboration output filename"
  );
  const corroborationFile = websiteCorroborationSummary.files?.[corroborationFilename];
  if (!corroborationFile) {
    failures.push("builder website corroboration summary: missing corroboration file metadata");
  } else {
    const corroborationPath = path.join(DATA_DIR, corroborationFilename);
    const actualStat = await stat(corroborationPath).catch(() => null);
    if (!actualStat) {
      failures.push(`${corroborationFilename}: file is missing`);
    } else {
      const corroborationStats = await inspectWebsiteCorroboration(corroborationPath);
      assertEqual(corroborationStats.rows, corroborationFile.rowCount, "builder website corroboration row count");
      assertEqual(corroborationStats.rows, websiteCorroborationSummary.totals?.fetchedCandidates, "builder website corroboration fetched count");
      assertEqual(corroborationStats.corroborated, websiteCorroborationSummary.totals?.corroboratedCandidates, "builder website corroboration confirmed count");
      assertEqual(await sha256File(corroborationPath), corroborationFile.sha256, "builder website corroboration sha256");
    }
  }
}

if (websiteUpdateProposalSummary) {
  assertEqual(websiteUpdateProposalSummary.schemaVersion, 1, "builder website update proposal summary schema version");
  assertEqual(websiteUpdateProposalSummary.source, "WEBSITE_CORROBORATION", "builder website update proposal summary source");
  if (!websiteUpdateProposalSummary.generatedAt) failures.push("builder website update proposal summary: missing generatedAt");
  if (!websiteUpdateProposalSummary.inputFile) failures.push("builder website update proposal summary: missing inputFile");
  if (!websiteUpdateProposalSummary.outputFile) failures.push("builder website update proposal summary: missing outputFile");
  safeArtifactFilename(websiteUpdateProposalSummary.inputFile, "builder website update proposal input filename");
  const proposalsFilename = safeArtifactFilename(
    websiteUpdateProposalSummary.outputFile ?? "builder-website-update-proposals.ndjson",
    "builder website update proposal output filename"
  );
  const proposalsPath = path.join(DATA_DIR, proposalsFilename);
  const actualStat = await stat(proposalsPath).catch(() => null);
  if (!actualStat) {
    failures.push(`${proposalsFilename}: file is missing`);
  } else {
    const proposalStats = await inspectWebsiteUpdateProposals(proposalsPath);
    const fileMetadata = websiteUpdateProposalSummary.files?.[proposalsFilename];
    assertEqual(proposalStats.rows, websiteUpdateProposalSummary.totals?.proposalRows, "builder website update proposal row count");
    assertEqual(proposalStats.proposedRows, websiteUpdateProposalSummary.totals?.proposedRows, "builder website update proposed row count");
    assertEqual(proposalStats.manualReviewRows, websiteUpdateProposalSummary.totals?.manualReviewRows, "builder website update manual-review row count");
    assertEqual(proposalStats.notProposedRows, websiteUpdateProposalSummary.totals?.notProposedRows, "builder website update not-proposed row count");
    if (!fileMetadata) {
      failures.push("builder website update proposal summary: missing proposal file metadata");
    } else {
      assertEqual(proposalStats.rows, fileMetadata.rowCount, "builder website update proposal file row count");
      assertEqual(await sha256File(proposalsPath), fileMetadata.sha256, "builder website update proposal file sha256");
    }
  }
  if ((websiteUpdateProposalSummary.totals?.proposedRows ?? 0) > (websiteUpdateProposalSummary.totals?.proposalRows ?? 0)) {
    failures.push("builder website update proposal summary: proposedRows cannot exceed proposalRows");
  }
  if (websiteCorroborationSummary) {
    assertEqual(
      websiteUpdateProposalSummary.totals?.scannedCorroborations,
      websiteCorroborationSummary.totals?.fetchedCandidates,
      "builder website update proposals scanned corroboration count"
    );
  }
}

if (abnLookupSummary) {
  assertEqual(abnLookupSummary.schemaVersion, 1, "builder ABN lookup summary schema version");
  assertEqual(abnLookupSummary.source, "ABN_LOOKUP_JSON", "builder ABN lookup summary source");
  if (!abnLookupSummary.checkedAt) failures.push("builder ABN lookup summary: missing checkedAt");
  if (!abnLookupSummary.outputFile) failures.push("builder ABN lookup summary: missing outputFile");
  const resultsFilename = safeArtifactFilename(abnLookupSummary.outputFile ?? "builder-abn-lookup-results.ndjson", "builder ABN lookup output filename");
  const resultsPath = path.join(DATA_DIR, resultsFilename);
  const actualStat = await stat(resultsPath).catch(() => null);
  if (!actualStat) {
    failures.push(`${resultsFilename}: file is missing`);
  } else {
    const resultStats = await inspectAbnLookupResults(resultsPath);
    const fileMetadata = abnLookupSummary.files?.[resultsFilename];
    assertEqual(resultStats.rows, abnLookupSummary.checkedJobs, "builder ABN lookup checked job count");
    assertEqual(resultStats.candidates, abnLookupSummary.candidateCount, "builder ABN lookup candidate count");
    assertEqual(resultStats.exactMatches, abnLookupSummary.exactMatchCount, "builder ABN lookup exact match count");
    if (!fileMetadata) {
      failures.push("builder ABN lookup summary: missing result file metadata");
    } else {
      assertEqual(resultStats.rows, fileMetadata.rowCount, "builder ABN lookup file row count");
      assertEqual(await sha256File(resultsPath), fileMetadata.sha256, "builder ABN lookup file sha256");
    }
  }
  if ((abnLookupSummary.checkedJobs ?? 0) > (abnLookupSummary.eligibleJobs ?? 0)) {
    failures.push("builder ABN lookup summary: checkedJobs cannot exceed eligibleJobs");
  }
  if ((abnLookupSummary.eligibleJobs ?? 0) > (abnLookupSummary.scannedJobs ?? 0)) {
    failures.push("builder ABN lookup summary: eligibleJobs cannot exceed scannedJobs");
  }
}

if (abnMergeSummary) {
  assertEqual(abnMergeSummary.schemaVersion, 1, "builder ABN merge summary schema version");
  assertEqual(abnMergeSummary.source, "ABN_LOOKUP_JSON", "builder ABN merge summary source");
  if (!abnMergeSummary.generatedAt) failures.push("builder ABN merge summary: missing generatedAt");
  if (!abnMergeSummary.inputFile) failures.push("builder ABN merge summary: missing inputFile");
  if (!abnMergeSummary.outputFile) failures.push("builder ABN merge summary: missing outputFile");
  safeArtifactFilename(abnMergeSummary.inputFile, "builder ABN merge input filename");
  const proposalsFilename = safeArtifactFilename(abnMergeSummary.outputFile ?? "builder-abn-merge-proposals.ndjson", "builder ABN merge output filename");
  const proposalsPath = path.join(DATA_DIR, proposalsFilename);
  const actualStat = await stat(proposalsPath).catch(() => null);
  if (!actualStat) {
    failures.push(`${proposalsFilename}: file is missing`);
  } else {
    const proposalStats = await inspectAbnMergeProposals(proposalsPath);
    const fileMetadata = abnMergeSummary.files?.[proposalsFilename];
    assertEqual(proposalStats.rows, abnMergeSummary.totals?.proposalRows, "builder ABN merge proposal row count");
    assertEqual(proposalStats.proposedRows, abnMergeSummary.totals?.proposedRows, "builder ABN merge proposed row count");
    assertEqual(proposalStats.manualReviewRows, abnMergeSummary.totals?.manualReviewRows, "builder ABN merge manual-review row count");
    assertEqual(proposalStats.notProposedRows, abnMergeSummary.totals?.notProposedRows, "builder ABN merge not-proposed row count");
    if (!fileMetadata) {
      failures.push("builder ABN merge summary: missing proposal file metadata");
    } else {
      assertEqual(proposalStats.rows, fileMetadata.rowCount, "builder ABN merge file row count");
      assertEqual(await sha256File(proposalsPath), fileMetadata.sha256, "builder ABN merge file sha256");
    }
  }
  if ((abnMergeSummary.totals?.proposedRows ?? 0) > (abnMergeSummary.totals?.proposalRows ?? 0)) {
    failures.push("builder ABN merge summary: proposedRows cannot exceed proposalRows");
  }
}

const duplicateReviewStats = manifest.files["builder-duplicate-review.ndjson"]
  ? await inspectDuplicateReviewRows(path.join(DATA_DIR, "builder-duplicate-review.ndjson"))
  : { rows: 0 };
assertEqual(duplicateReviewStats.rows, manifest.files["builder-duplicate-review.ndjson"]?.rowCount ?? 0, "duplicate review row count");

if (productionReadinessReport) {
  assertEqual(productionReadinessReport.schemaVersion, 1, "builder production readiness schema version");
  assertEqual(productionReadinessReport.summary?.builders, manifest.totals.builders, "builder production readiness builder total");
  assertEqual(productionReadinessReport.summary?.licences, manifest.totals.licences, "builder production readiness licence total");
  assertArraySetEqual(productionReadinessReport.summary?.importedStates ?? [], manifest.importedStates ?? [], "builder production readiness imported states");
  assertArraySetEqual(productionReadinessReport.summary?.pendingStates ?? [], manifest.pendingStates ?? [], "builder production readiness pending states");
  assertEqual(productionReadinessReport.summary?.detailedListRows, detailedListSummary?.totals?.builders ?? 0, "builder production readiness detailed rows");
  assertEqual(productionReadinessReport.summary?.enrichmentJobs, enrichmentSummary?.totals?.jobRows ?? 0, "builder production readiness enrichment jobs");
  assertEqual(productionReadinessReport.summary?.websiteDiscoveryJobs, websiteDiscoverySummary?.totals?.writtenJobs ?? 0, "builder production readiness website discovery jobs");
  assertEqual(productionReadinessReport.summary?.websiteSearchRequests, websiteSearchRequestsSummary?.totals?.writtenRequests ?? 0, "builder production readiness website search requests");
  assertEqual(productionReadinessReport.summary?.websiteCandidateRows, websiteCandidateSummary?.totals?.writtenCandidates ?? 0, "builder production readiness website candidate rows");
  assertEqual(productionReadinessReport.summary?.websiteCorroborationRows, websiteCorroborationSummary?.totals?.fetchedCandidates ?? 0, "builder production readiness website corroboration rows");
  assertEqual(productionReadinessReport.summary?.websiteCorroboratedRows, websiteCorroborationSummary?.totals?.corroboratedCandidates ?? 0, "builder production readiness website corroborated rows");
  assertEqual(productionReadinessReport.summary?.websiteUpdateProposalRows, websiteUpdateProposalSummary?.totals?.proposalRows ?? 0, "builder production readiness website update proposal rows");
  assertEqual(productionReadinessReport.summary?.websiteUpdateProposedRows, websiteUpdateProposalSummary?.totals?.proposedRows ?? 0, "builder production readiness website update proposed rows");
  assertEqual(productionReadinessReport.summary?.detailedListAuditStatus, detailedListAudit?.status ?? "missing", "builder production readiness detailed-list audit status");
  assertEqual(
    productionReadinessReport.summary?.detailedListAuditHardFailures,
    detailedListAudit?.hardFailures?.length ?? 0,
    "builder production readiness detailed-list audit hard failures"
  );
  assertEqual(
    productionReadinessReport.summary?.sourceAccessRequestRows,
    sourceAccessRequests?.requests?.length ?? 0,
    "builder production readiness source access request rows"
  );
  assertEqual(
    productionReadinessReport.summary?.duplicateReviewRows,
    duplicateReviewStats.rows,
    "builder production readiness duplicate review rows"
  );
  assertEqual(productionReadinessReport.summary?.abnLookupRows, abnLookupSummary?.checkedJobs ?? 0, "builder production readiness ABN lookup rows");
  const pendingBlockers = (productionReadinessReport.blockers ?? []).filter((blocker) => blocker.blockerId?.startsWith("pending_source_"));
  assertEqual(pendingBlockers.length, manifest.pendingStates?.length ?? 0, "builder production readiness pending-source blocker count");
  if ((manifest.pendingStates?.length ?? 0) > 0 && productionReadinessReport.status === "production_ready") {
    failures.push("builder production readiness: cannot be production_ready while manifest has pending states");
  }
  if ((productionReadinessReport.summary?.websiteCandidateRows ?? 0) === 0 && !(productionReadinessReport.blockers ?? []).some((blocker) => blocker.blockerId === "website_search_evidence_missing")) {
    failures.push("builder production readiness: missing website-search blocker while candidate rows are zero");
  }
  if ((productionReadinessReport.summary?.abnLookupRows ?? 0) === 0 && !(productionReadinessReport.blockers ?? []).some((blocker) => blocker.blockerId === "abn_lookup_guid_missing_or_not_run")) {
    failures.push("builder production readiness: missing ABN blocker while ABN lookup rows are zero");
  }
  if (
    productionReadinessReport.summary?.detailedListAuditStatus !== "passed" &&
    !(productionReadinessReport.blockers ?? []).some((blocker) => blocker.blockerId === "detailed_list_audit_missing_or_failed")
  ) {
    failures.push("builder production readiness: missing detailed-list audit blocker while audit is not passed");
  }
  if (
    (manifest.pendingStates?.length ?? 0) > 0 &&
    !(productionReadinessReport.checks ?? []).some((check) => check.checkId === "source_access_requests_ready" && check.ok === true)
  ) {
    failures.push("builder production readiness: source access request readiness check must pass while pending states remain");
  }
}

for (const [filename, expected] of Object.entries(manifest.files ?? {})) {
  const safeFilename = safeArtifactFilename(filename, `manifest file ${filename}`);
  if (!safeFilename) continue;
  const filepath = path.join(DATA_DIR, safeFilename);
  const actualStat = await stat(filepath).catch(() => null);
  if (!actualStat) {
    failures.push(`${safeFilename}: file is missing`);
    continue;
  }
  assertEqual(actualStat.size, expected.bytes, `${safeFilename} byte size`);
  assertEqual(await sha256File(filepath), expected.sha256, `${safeFilename} sha256`);
  if (expected.format === "ndjson") {
    assertEqual(await countNdjsonRows(filepath), expected.rowCount, `${safeFilename} row count`);
  } else if (safeFilename === "builders.json" || safeFilename === "builder-licences.json" || safeFilename === "sources.json") {
    const value = await readJson(safeFilename);
    assertEqual(Array.isArray(value) ? value.length : 1, expected.rowCount, `${safeFilename} JSON row count`);
  } else if (isSourceExtractValidationFilename(safeFilename)) {
    const value = await readJson(safeFilename);
    verifySourceExtractValidationReport(safeFilename, value, expected);
  }
}

assertEqual(manifest.files["builders.ndjson"]?.rowCount, manifest.totals.builders, "builder NDJSON rows match manifest total");
assertEqual(manifest.files["builder-memory-cards.ndjson"]?.rowCount, manifest.totals.builders, "memory card rows match builder total");
assertEqual(manifest.files["builder-search-index.ndjson"]?.rowCount, manifest.totals.builders, "search index rows match builder total");
assertEqual(manifest.files["builder-licences.ndjson"]?.rowCount, manifest.totals.licences, "licence NDJSON rows match manifest total");
assertEqual(manifest.files["source-access-report.json"]?.rowCount, 1, "source access report is manifest listed");
assertEqual(Array.isArray(sources), true, "sources registry is an array");

for (const [name, value] of Object.entries(manifest.invariants ?? {})) {
  assertEqual(value, true, `manifest invariant ${name}`);
}

for (const stat of manifest.sourceStats ?? []) {
  assertEqual(stat.complete, true, `${stat.sourceId} source import is complete`);
  if (!stat.builderRowsAccepted || stat.builderRowsAccepted < 1) failures.push(`${stat.sourceId}: accepted no builder rows`);
}

const sourceIds = new Set(sources.map((source) => source.id));
const importedSourceIds = new Set((sourceAccessReport.importedSources ?? []).map((source) => source.sourceId));
const pendingSourceIds = new Set((sourceAccessReport.pendingSources ?? []).map((source) => source.sourceId));

for (const sourceId of importedSourceIds) {
  if (!sourceIds.has(sourceId)) failures.push(`source access imported source ${sourceId}: not present in sources registry`);
  if (pendingSourceIds.has(sourceId)) failures.push(`source access source ${sourceId}: listed as both imported and pending`);
}

for (const pendingSource of sourceAccessReport.pendingSources ?? []) {
  if (!sourceIds.has(pendingSource.sourceId)) failures.push(`pending source ${pendingSource.sourceId}: not present in sources registry`);
  if (!manifest.pendingStates?.includes(pendingSource.state)) failures.push(`pending source ${pendingSource.sourceId}: state is not manifest-pending`);
  if (!pendingSource.accessStatus) failures.push(`pending source ${pendingSource.sourceId}: missing accessStatus`);
  if (!pendingSource.evidence?.length) failures.push(`pending source ${pendingSource.sourceId}: missing access evidence`);
  for (const evidence of pendingSource.evidence ?? []) {
    assertEvidenceRecord(evidence, `${pendingSource.sourceId} access evidence`);
  }
}

for (const rejectedCandidate of sourceAccessReport.rejectedCandidates ?? []) {
  assertEvidenceRecord(rejectedCandidate, `${rejectedCandidate.sourceId} rejected candidate`);
  if (!rejectedCandidate.importDecision?.startsWith("rejected_")) {
    failures.push(`${rejectedCandidate.sourceId} rejected candidate: importDecision must start with rejected_`);
  }
  if (importedSourceIds.has(rejectedCandidate.sourceId)) {
    failures.push(`${rejectedCandidate.sourceId} rejected candidate: source is also imported`);
  }
}

function verifySourceExtractValidationReport(filename, report, expected) {
  const pendingSourceIds = new Set((sourceAccessReport.pendingSources ?? []).map((source) => source.sourceId));
  const requestSourceIds = new Set((sourceAccessRequests?.requests ?? []).map((request) => request.sourceId));
  assertEqual(expected.format, "json", `${filename} manifest format`);
  assertEqual(expected.rowCount, 1, `${filename} manifest row count`);
  assertEqual(report.schemaVersion, 1, `${filename} schema version`);
  if (!report.generatedAt) failures.push(`${filename}: missing generatedAt`);
  if (!manifest.pendingStates?.includes(report.state)) failures.push(`${filename}: state ${report.state ?? "unknown"} is not manifest-pending`);
  if (!pendingSourceIds.has(report.sourceId)) failures.push(`${filename}: sourceId ${report.sourceId ?? "unknown"} is not a pending source`);
  if (!requestSourceIds.has(report.sourceId)) failures.push(`${filename}: sourceId ${report.sourceId ?? "unknown"} has no source-access request packet`);
  if (!["ready_for_mapper_implementation", "not_importable"].includes(report.importDecision)) {
    failures.push(`${filename}: invalid importDecision ${report.importDecision ?? "missing"}`);
  }
  if ("rows" in report) failures.push(`${filename}: validation report must not store raw extract rows`);
  if (!report.inputFile?.filename) failures.push(`${filename}: missing input file filename`);
  if (!Number.isFinite(report.inputFile?.bytes) || report.inputFile.bytes <= 0) failures.push(`${filename}: missing input file byte size`);
  if (!/^[a-f0-9]{64}$/.test(report.inputFile?.sha256 ?? "")) failures.push(`${filename}: missing input file SHA-256`);
  if (!Array.isArray(report.checks) || !report.checks.length) failures.push(`${filename}: missing validation checks`);
  if (!Array.isArray(report.hardFailures)) failures.push(`${filename}: hardFailures must be an array`);
  const failedCheckIds = new Set((report.checks ?? []).filter((check) => !check.ok).map((check) => check.checkId));
  for (const hardFailure of report.hardFailures ?? []) {
    if (!failedCheckIds.has(hardFailure)) failures.push(`${filename}: hard failure ${hardFailure} does not match a failed check`);
  }
  if (report.importDecision === "ready_for_mapper_implementation") {
    if ((report.hardFailures ?? []).length) failures.push(`${filename}: ready report must not contain hard failures`);
    if (!hasPermissionEvidence(report.permissionEvidence)) failures.push(`${filename}: ready report is missing permission evidence`);
    if ((report.rowStats?.builderClassRows ?? 0) < 1) failures.push(`${filename}: ready report has no builder-class rows`);
  }
  if (report.permissionEvidence?.filepath) failures.push(`${filename}: permission evidence must store file metadata, not local file paths`);
  if (report.permissionEvidence?.file && !/^[a-f0-9]{64}$/.test(report.permissionEvidence.file.sha256 ?? "")) {
    failures.push(`${filename}: permission evidence file is missing SHA-256`);
  }
}

function isSourceExtractValidationFilename(filename) {
  return /^source-extract-validation-[a-z0-9-]+\.json$/.test(filename);
}

function hasPermissionEvidence(permissionEvidence) {
  return Boolean(normalizeText(permissionEvidence?.reference) || /^[a-f0-9]{64}$/.test(permissionEvidence?.file?.sha256 ?? ""));
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

if (failures.length) {
  console.error(`Builder data verification failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({
  status: "ok",
  builders: manifest.totals.builders,
  licences: manifest.totals.licences,
  memoryCards: manifest.files["builder-memory-cards.ndjson"]?.rowCount,
  searchIndexRows: manifest.files["builder-search-index.ndjson"]?.rowCount,
  duplicateReviewRows: duplicateReviewStats.rows,
  enrichmentJobs: enrichmentSummary?.totals?.jobRows ?? 0,
  locationEvidenceAudit: Boolean(locationEvidenceAudit),
  detailedListAudit: detailedListAudit?.status ?? null,
  websiteDiscoveryJobs: websiteDiscoverySummary?.totals?.writtenJobs ?? 0,
  websiteSearchRequests: websiteSearchRequestsSummary?.totals?.writtenRequests ?? 0,
  websiteCandidateRows: websiteCandidateSummary?.totals?.writtenCandidates ?? 0,
  websiteCorroborationRows: websiteCorroborationSummary?.totals?.fetchedCandidates ?? 0,
  websiteCorroboratedRows: websiteCorroborationSummary?.totals?.corroboratedCandidates ?? 0,
  websiteUpdateProposalRows: websiteUpdateProposalSummary?.totals?.proposalRows ?? 0,
  websiteUpdateProposedRows: websiteUpdateProposalSummary?.totals?.proposedRows ?? 0,
  detailedListRows: detailedListSummary?.totals?.builders ?? 0,
  abnLookupRows: abnLookupSummary?.checkedJobs ?? 0,
  abnMergeProposalRows: abnMergeSummary?.totals?.proposalRows ?? 0,
  productionReadiness: productionReadinessReport?.status ?? null,
  verifiedFiles: Object.keys(manifest.files ?? {}).length,
}, null, 2));

async function readJson(filename) {
  return JSON.parse(await readFile(path.join(DATA_DIR, filename), "utf8"));
}

async function readOptionalJson(filename) {
  const filepath = path.join(DATA_DIR, filename);
  try {
    await access(filepath);
    return JSON.parse(await readFile(filepath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) failures.push(`${label}: expected ${expected}, received ${actual}`);
}

function assertArraySetEqual(actual = [], expected = [], label) {
  const actualSorted = [...actual].sort();
  const expectedSorted = [...expected].sort();
  assertEqual(JSON.stringify(actualSorted), JSON.stringify(expectedSorted), label);
}

function assertEvidenceRecord(evidence, label) {
  if (!evidence.checkedAt) failures.push(`${label}: missing checkedAt`);
  if (!evidence.url) failures.push(`${label}: missing url`);
  if (!evidence.finding) failures.push(`${label}: missing finding`);
  if (!evidence.importDecision) failures.push(`${label}: missing importDecision`);
}

function safeArtifactFilename(filename, label) {
  const text = String(filename ?? "").trim();
  if (
    !text ||
    path.isAbsolute(text) ||
    text !== path.basename(text) ||
    text.includes("/") ||
    text.includes("\\") ||
    text.includes("\0") ||
    text === "." ||
    text === ".." ||
    !/^[a-z0-9][a-z0-9._-]*$/i.test(text)
  ) {
    failures.push(`${label}: must be a filename inside the builder artifact directory`);
    return "__invalid_builder_artifact_filename__";
  }
  return text;
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

async function countNdjsonRows(filepath) {
  let count = 0;
  const rl = createInterface({ input: createReadStream(filepath) });
  for await (const line of rl) {
    if (line.trim()) count += 1;
  }
  return count;
}

async function inspectAbnLookupResults(filepath) {
  let rows = 0;
  let candidates = 0;
  let exactMatches = 0;
  for await (const row of readNdjson(filepath)) {
    rows += 1;
    assertEqual(row.schemaVersion, 1, `ABN lookup result ${rows} schema version`);
    if (!row.builderId) failures.push(`ABN lookup result ${rows}: missing builderId`);
    if (!row.jobId) failures.push(`ABN lookup result ${rows}: missing jobId`);
    if (row.source !== "ABN_LOOKUP_JSON") failures.push(`ABN lookup result ${rows}: source must be ABN_LOOKUP_JSON`);
    if (row.status !== "checked" && row.status !== "skipped") failures.push(`ABN lookup result ${rows}: unknown status ${row.status}`);
    if (containsCredentialKey(row)) failures.push(`ABN lookup result ${rows}: must not persist credential fields`);
    if (row.status === "checked") {
      if (!row.checkedAt) failures.push(`ABN lookup result ${rows}: missing checkedAt`);
      if (!row.sourceUrl) failures.push(`ABN lookup result ${rows}: missing sourceUrl`);
      if (!Array.isArray(row.candidates)) failures.push(`ABN lookup result ${rows}: candidates must be an array`);
      if (!Array.isArray(row.exactMatches)) failures.push(`ABN lookup result ${rows}: exactMatches must be an array`);
      for (const [candidateIndex, candidate] of (row.candidates ?? []).entries()) {
        if (!candidate.abn && !candidate.acn) failures.push(`ABN lookup result ${rows}: candidate missing ABN/ACN`);
        if (!candidate.name) failures.push(`ABN lookup result ${rows}: candidate missing name`);
        if (!candidate.matchConfidence) failures.push(`ABN lookup result ${rows}: candidate missing matchConfidence`);
        if (containsCredentialKey(candidate)) failures.push(`ABN lookup result ${rows}.${candidateIndex + 1}: candidate must not persist credential fields`);
      }
      for (const [matchIndex, match] of (row.exactMatches ?? []).entries()) {
        if (containsCredentialKey(match)) failures.push(`ABN lookup result ${rows}.exactMatch.${matchIndex + 1}: exact match must not persist credential fields`);
      }
      candidates += row.candidates?.length ?? 0;
      exactMatches += row.exactMatches?.length ?? 0;
    }
  }
  return { rows, candidates, exactMatches };
}

async function inspectWebsiteDiscoveryJobs(filepath) {
  let rows = 0;
  let searchQueries = 0;
  for await (const row of readNdjson(filepath)) {
    rows += 1;
    assertEqual(row.schemaVersion, 1, `website discovery job ${rows} schema version`);
    if (!row.discoveryJobId) failures.push(`website discovery job ${rows}: missing discoveryJobId`);
    if (!row.builderId) failures.push(`website discovery job ${rows}: missing builderId`);
    if (!row.enrichmentJobId) failures.push(`website discovery job ${rows}: missing enrichmentJobId`);
    if (!row.name) failures.push(`website discovery job ${rows}: missing name`);
    if (!row.generatedAt) failures.push(`website discovery job ${rows}: missing generatedAt`);
    if (!Array.isArray(row.searchQueries) || !row.searchQueries.length) failures.push(`website discovery job ${rows}: missing searchQueries`);
    if (row.websiteUrl || row.proposedWebsiteUrl) failures.push(`website discovery job ${rows}: must not contain a proposed website URL`);
    if (!Array.isArray(row.constraints) || !row.constraints.some((item) => item.includes("do not invent or guess website URLs"))) {
      failures.push(`website discovery job ${rows}: missing no-guessing website constraint`);
    }
    searchQueries += row.searchQueries?.length ?? 0;
  }
  return { rows, searchQueries };
}

async function inspectWebsiteSearchRequests(filepath) {
  let rows = 0;
  let pendingRows = 0;
  for await (const row of readNdjson(filepath)) {
    rows += 1;
    assertEqual(row.schemaVersion, 1, `website search request ${rows} schema version`);
    if (!row.requestId) failures.push(`website search request ${rows}: missing requestId`);
    if (!row.discoveryJobId) failures.push(`website search request ${rows}: missing discoveryJobId`);
    if (!row.builderId) failures.push(`website search request ${rows}: missing builderId`);
    if (!row.builderName) failures.push(`website search request ${rows}: missing builderName`);
    if (!row.query) failures.push(`website search request ${rows}: missing query`);
    if (row.requestStatus !== "pending_search_provider") failures.push(`website search request ${rows}: requestStatus must remain pending_search_provider`);
    if (row.url || row.host || row.title || row.snippet) failures.push(`website search request ${rows}: must not contain search result fields`);
    if (!Array.isArray(row.constraints) || !row.constraints.some((item) => item.includes("Do not infer a website URL"))) {
      failures.push(`website search request ${rows}: missing no-inference website constraint`);
    }
    pendingRows += row.requestStatus === "pending_search_provider" ? 1 : 0;
  }
  return { rows, pendingRows };
}

async function inspectWebsiteSearchResults(filepath) {
  let rows = 0;
  let resultRows = 0;
  for await (const row of readNdjson(filepath)) {
    rows += 1;
    assertEqual(row.schemaVersion, 1, `website search result ${rows} schema version`);
    if (row.status !== "searched") failures.push(`website search result ${rows}: status must be searched`);
    if (!row.searchedAt) failures.push(`website search result ${rows}: missing searchedAt`);
    if (!row.provider) failures.push(`website search result ${rows}: missing provider`);
    if (!row.requestId) failures.push(`website search result ${rows}: missing requestId`);
    if (!row.discoveryJobId) failures.push(`website search result ${rows}: missing discoveryJobId`);
    if (!row.builderId) failures.push(`website search result ${rows}: missing builderId`);
    if (!row.query) failures.push(`website search result ${rows}: missing query`);
    if (!Array.isArray(row.results)) failures.push(`website search result ${rows}: results must be an array`);
    if (containsCredentialKey(row)) failures.push(`website search result ${rows}: must not persist credential or authorization fields`);
    if (row.reviewOnly !== undefined || row.autoApply !== undefined) failures.push(`website search result ${rows}: raw provider evidence must not include apply/review flags`);
    assertEqual(row.resultCount, row.results?.length ?? 0, `website search result ${rows} resultCount`);
    for (const [index, result] of (row.results ?? []).entries()) {
      if (!result.url) failures.push(`website search result ${rows}.${index + 1}: missing URL`);
      if (!Number.isFinite(result.rank) || result.rank < 1) failures.push(`website search result ${rows}.${index + 1}: invalid rank`);
      if (containsCredentialKey(result)) failures.push(`website search result ${rows}.${index + 1}: must not persist credential or authorization fields`);
    }
    resultRows += row.results?.length ?? 0;
  }
  return { rows, resultRows };
}

async function inspectDetailedBuilderRows(filepath) {
  let rows = 0;
  let licences = 0;
  for await (const row of readNdjson(filepath)) {
    rows += 1;
    assertEqual(row.schemaVersion, 1, `builder detailed list row ${rows} schema version`);
    if (!row.builderId) failures.push(`builder detailed list row ${rows}: missing builderId`);
    if (!row.name) failures.push(`builder detailed list row ${rows}: missing name`);
    if (!Array.isArray(row.states) || !row.states.length) failures.push(`builder detailed list row ${rows}: missing states`);
    if (!Array.isArray(row.licences)) failures.push(`builder detailed list row ${rows}: licences must be an array`);
    if (!Array.isArray(row.limitations)) failures.push(`builder detailed list row ${rows}: limitations must be an array`);
    if (!Array.isArray(row.evidenceNotes)) failures.push(`builder detailed list row ${rows}: evidenceNotes must be an array`);
    licences += row.licenceCount ?? 0;
    for (const licence of row.licences ?? []) {
      if (!licence.licenceNumber) failures.push(`builder detailed list row ${rows}: licence missing licenceNumber`);
      if (!licence.sourceId) failures.push(`builder detailed list row ${rows}: licence missing sourceId`);
      if (!licence.rawSourceUrl) failures.push(`builder detailed list row ${rows}: licence missing rawSourceUrl`);
    }
  }
  return { rows, licences };
}

async function inspectDuplicateReviewRows(filepath) {
  let rows = 0;
  for await (const row of readNdjson(filepath)) {
    rows += 1;
    if (!row.id) failures.push(`duplicate review ${rows}: missing id`);
    if (!row.normalizedName) failures.push(`duplicate review ${rows}: missing normalizedName`);
    if (!row.reviewReason) failures.push(`duplicate review ${rows}: missing reviewReason`);
    if (row.reviewOnly !== true) failures.push(`duplicate review ${rows}: reviewOnly must be true`);
    if (row.autoMerge !== false) failures.push(`duplicate review ${rows}: autoMerge must be false`);
    if (!Number.isFinite(row.builderCount) || row.builderCount < 2) failures.push(`duplicate review ${rows}: builderCount must be at least 2`);
    if (!Array.isArray(row.builderIds) || row.builderIds.length !== row.builderCount) {
      failures.push(`duplicate review ${rows}: builderIds must match builderCount`);
    }
    if (!Array.isArray(row.states) || !row.states.length) failures.push(`duplicate review ${rows}: missing states`);
    if (!Array.isArray(row.notes) || !row.notes.some((note) => note.includes("Review"))) {
      failures.push(`duplicate review ${rows}: missing review instruction note`);
    }
  }
  return { rows };
}

function containsCredentialKey(value) {
  if (!value || typeof value !== "object") return false;
  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (["apikey", "bravesearchapikey", "abnlookupguid", "guid", "xsubscriptiontoken", "authorization", "bearer", "secret", "credential", "credentials"].includes(normalizedKey)) {
      return true;
    }
    if (containsCredentialKey(child)) return true;
  }
  return false;
}

async function inspectWebsiteCandidates(filepath) {
  let rows = 0;
  for await (const row of readNdjson(filepath)) {
    rows += 1;
    assertEqual(row.schemaVersion, 1, `website candidate ${rows} schema version`);
    if (!row.candidateId) failures.push(`website candidate ${rows}: missing candidateId`);
    if (!row.builderId) failures.push(`website candidate ${rows}: missing builderId`);
    if (!row.discoveryJobId) failures.push(`website candidate ${rows}: missing discoveryJobId`);
    if (!row.url) failures.push(`website candidate ${rows}: missing url`);
    if (!row.host) failures.push(`website candidate ${rows}: missing host`);
    if (row.reviewOnly !== true) failures.push(`website candidate ${rows}: reviewOnly must be true`);
    if (row.autoApply !== false) failures.push(`website candidate ${rows}: autoApply must be false`);
    if (!["candidate", "review_required"].includes(row.candidateStatus)) failures.push(`website candidate ${rows}: unknown candidateStatus ${row.candidateStatus}`);
    if (!Array.isArray(row.constraints) || !row.constraints.some((item) => item.includes("do not update builder.websiteUrl"))) {
      failures.push(`website candidate ${rows}: missing no-auto-update constraint`);
    }
    try {
      new URL(row.url);
    } catch {
      failures.push(`website candidate ${rows}: invalid URL`);
    }
  }
  return { rows };
}

async function inspectWebsiteCorroboration(filepath) {
  let rows = 0;
  let corroborated = 0;
  for await (const row of readNdjson(filepath)) {
    rows += 1;
    assertEqual(row.schemaVersion, 1, `website corroboration ${rows} schema version`);
    if (!row.corroborationId) failures.push(`website corroboration ${rows}: missing corroborationId`);
    if (!row.candidateId) failures.push(`website corroboration ${rows}: missing candidateId`);
    if (!row.builderId) failures.push(`website corroboration ${rows}: missing builderId`);
    if (!row.url) failures.push(`website corroboration ${rows}: missing url`);
    if (!["corroborated", "review_required"].includes(row.corroborationStatus)) {
      failures.push(`website corroboration ${rows}: unknown corroborationStatus ${row.corroborationStatus}`);
    }
    if (row.reviewOnly !== true) failures.push(`website corroboration ${rows}: reviewOnly must be true`);
    if (row.autoApply !== false) failures.push(`website corroboration ${rows}: autoApply must be false`);
    if (!Array.isArray(row.constraints) || !row.constraints.some((item) => item.includes("must not auto-apply"))) {
      failures.push(`website corroboration ${rows}: missing no-auto-apply constraint`);
    }
    try {
      new URL(row.url);
    } catch {
      failures.push(`website corroboration ${rows}: invalid URL`);
    }
    if (row.corroborationStatus === "corroborated") corroborated += 1;
  }
  return { rows, corroborated };
}

async function inspectWebsiteUpdateProposals(filepath) {
  let rows = 0;
  let proposedRows = 0;
  let manualReviewRows = 0;
  let notProposedRows = 0;
  for await (const row of readNdjson(filepath)) {
    rows += 1;
    assertEqual(row.schemaVersion, 1, `website update proposal ${rows} schema version`);
    if (row.source !== "WEBSITE_CORROBORATION") failures.push(`website update proposal ${rows}: source must be WEBSITE_CORROBORATION`);
    if (!row.builderId) failures.push(`website update proposal ${rows}: missing builderId`);
    if (!row.candidateId) failures.push(`website update proposal ${rows}: missing candidateId`);
    if (!row.corroborationId) failures.push(`website update proposal ${rows}: missing corroborationId`);
    if (!row.generatedAt) failures.push(`website update proposal ${rows}: missing generatedAt`);
    if (row.reviewOnly !== true) failures.push(`website update proposal ${rows}: reviewOnly must be true`);
    if (row.autoApply !== false) failures.push(`website update proposal ${rows}: autoApply must be false`);
    if (!["proposed", "manual_review", "not_proposed"].includes(row.proposalStatus)) {
      failures.push(`website update proposal ${rows}: unknown proposalStatus ${row.proposalStatus}`);
    }
    if (row.proposalStatus === "proposed") {
      proposedRows += 1;
      if (!row.proposalId) failures.push(`website update proposal ${rows}: proposed row missing proposalId`);
      if (!row.confidence) failures.push(`website update proposal ${rows}: proposed row missing confidence`);
      if (!row.proposedUpdates?.websiteUrl) failures.push(`website update proposal ${rows}: proposed row missing websiteUrl update`);
      if (row.evidence?.source !== "WEBSITE_CORROBORATION") failures.push(`website update proposal ${rows}: proposed row missing corroboration evidence source`);
      try {
        new URL(row.proposedUpdates?.websiteUrl);
      } catch {
        failures.push(`website update proposal ${rows}: proposed row has invalid websiteUrl`);
      }
    } else if (row.proposalStatus === "manual_review") {
      manualReviewRows += 1;
      if (Object.keys(row.proposedUpdates ?? {}).length) failures.push(`website update proposal ${rows}: manual-review row must not include proposed updates`);
    } else {
      notProposedRows += 1;
      if (Object.keys(row.proposedUpdates ?? {}).length) failures.push(`website update proposal ${rows}: not-proposed row must not include proposed updates`);
    }
  }
  return { rows, proposedRows, manualReviewRows, notProposedRows };
}

async function inspectAbnMergeProposals(filepath) {
  let rows = 0;
  let proposedRows = 0;
  let manualReviewRows = 0;
  let notProposedRows = 0;
  for await (const row of readNdjson(filepath)) {
    rows += 1;
    assertEqual(row.schemaVersion, 1, `ABN merge proposal ${rows} schema version`);
    if (row.source !== "ABN_LOOKUP_JSON") failures.push(`ABN merge proposal ${rows}: source must be ABN_LOOKUP_JSON`);
    if (!row.builderId) failures.push(`ABN merge proposal ${rows}: missing builderId`);
    if (!row.jobId) failures.push(`ABN merge proposal ${rows}: missing jobId`);
    if (!row.generatedAt) failures.push(`ABN merge proposal ${rows}: missing generatedAt`);
    if (row.reviewOnly !== true) failures.push(`ABN merge proposal ${rows}: reviewOnly must be true`);
    if (row.autoApply !== false) failures.push(`ABN merge proposal ${rows}: autoApply must be false`);
    if (containsCredentialKey(row)) failures.push(`ABN merge proposal ${rows}: must not persist credential fields`);
    if (!["proposed", "manual_review", "not_proposed"].includes(row.proposalStatus)) {
      failures.push(`ABN merge proposal ${rows}: unknown proposalStatus ${row.proposalStatus}`);
    }
    if (row.proposalStatus === "proposed") {
      proposedRows += 1;
      if (!row.proposalId) failures.push(`ABN merge proposal ${rows}: proposed row missing proposalId`);
      if (!row.confidence) failures.push(`ABN merge proposal ${rows}: proposed row missing confidence`);
      if (!row.proposedUpdates?.abn && !row.proposedUpdates?.acn) failures.push(`ABN merge proposal ${rows}: proposed row missing ABN/ACN update`);
      if (row.evidence?.source !== "ABN_LOOKUP_JSON") failures.push(`ABN merge proposal ${rows}: proposed row missing ABN Lookup evidence source`);
      if (!row.evidence?.candidate) failures.push(`ABN merge proposal ${rows}: proposed row missing candidate evidence`);
    } else if (row.proposalStatus === "manual_review") {
      manualReviewRows += 1;
      if (Object.keys(row.proposedUpdates ?? {}).length) failures.push(`ABN merge proposal ${rows}: manual-review row must not include proposed updates`);
    } else {
      notProposedRows += 1;
      if (Object.keys(row.proposedUpdates ?? {}).length) failures.push(`ABN merge proposal ${rows}: not-proposed row must not include proposed updates`);
    }
  }
  return { rows, proposedRows, manualReviewRows, notProposedRows };
}

async function* readNdjson(filepath) {
  const rl = createInterface({ input: createReadStream(filepath) });
  for await (const line of rl) {
    if (line.trim()) yield JSON.parse(line);
  }
}
