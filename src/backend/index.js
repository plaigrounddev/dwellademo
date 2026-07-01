import { createBuildersService } from "./builders.js";
import { createBriefsService } from "./briefs.js";
import { createDocumentsService } from "./documents.js";
import { createAgentRunsService } from "./agentRuns.js";
import { createOutreachService } from "./outreach.js";
import { createProjectsService } from "./projects.js";
import { createQuotesService } from "./quotes.js";

export { createMemoryRepository } from "./repository.js";
export {
  buildAbnMergeProposalFromResult,
  buildAbnLookupPlanFromJob,
  createAbnLookupClient,
  normalizeBusinessNumber,
  runAbnLookupForJob,
  writeAbnMergeProposals,
} from "./abnLookup.js";
export {
  assertNewBuilderArtifactPath,
  assertSafeBuilderArtifactFilename,
  DEFAULT_BUILDER_DATA_DIR,
  getBuilderArtifactEvidence,
  readBuilderArtifactManifest,
  searchBuilderArtifacts,
  searchBuilderDuplicateReviewArtifacts,
} from "./builderArtifacts.js";
export { buildBuilderCoverageStatus, getBuilderCoverageStatus } from "./builderCoverageStatus.js";
export { BUILDER_DETAILED_LIST_FIELDS, buildDetailedBuilderRecord, writeDetailedBuilderList } from "./builderDetailedList.js";
export { buildDetailedListAudit, writeDetailedListAudit } from "./builderDetailedListAudit.js";
export { detectBuilderEnrichmentGaps, getBuilderEnrichmentPlan, writeBuilderEnrichmentJobs } from "./builderEnrichmentPlan.js";
export { buildBuilderLocationEvidenceAudit, writeBuilderLocationEvidenceAudit } from "./builderLocationEvidenceAudit.js";
export {
  buildBuilderProductionReadinessReport,
  buildBuilderProductionReadinessReportFromArtifacts,
  writeBuilderProductionReadinessReport,
} from "./builderProductionReadiness.js";
export {
  buildWebsiteDiscoveryJobFromEnrichmentJob,
  buildWebsiteDiscoveryPlanFromJob,
  scoreWebsiteDiscoveryCandidate,
  writeWebsiteDiscoveryCandidates,
  writeWebsiteDiscoveryJobs,
} from "./builderWebsiteDiscovery.js";
export {
  buildWebsiteCorroborationPlan,
  buildWebsiteUpdateProposalFromCorroboration,
  extractPageText,
  fetchWebsiteCorroboration,
  writeWebsiteCorroborationEvidence,
  writeWebsiteUpdateProposals,
} from "./builderWebsiteCorroboration.js";
export { buildWebsiteSearchRequest, writeWebsiteSearchRequests } from "./builderWebsiteSearchRequests.js";
export {
  buildWebsiteSearchProviderPlan,
  createBraveWebSearchClient,
  normalizeBraveWebSearchResponse,
  runWebsiteSearchProviderRequest,
  writeWebsiteSearchProviderResults,
} from "./builderWebsiteSearchProvider.js";
export { createProjectsService } from "./projects.js";
export { createBuildersService } from "./builders.js";
export { createBriefsService, renderBuilderBrief } from "./briefs.js";
export { createDocumentsService } from "./documents.js";
export { createOutreachService } from "./outreach.js";
export { createQuotesService } from "./quotes.js";
export { createAgentRunsService, DURABLE_AGENT_REQUIREMENTS } from "./agentRuns.js";
export { BackendError } from "./errors.js";
export { DWELLA_SYSTEM_PROMPT } from "./agentPrompt.js";
export {
  DWELLA_AGENT_INSTRUCTIONS,
  DWELLA_CONVERSATION_CONTRACT,
  DWELLA_FIRST_CONVERSATION_MESSAGE,
  DWELLA_REALTIME_INSTRUCTIONS,
} from "../../convex/dwellaConversationContract.js";
export { BUILDER_DATA_SOURCES, listBuilderDataSources } from "./builderDataSources.js";
export { recheckPendingBuilderSourceAccess, summarizeSourceProbe, toConvexSourceAccessRecheck } from "./builderSourceAccessRecheck.js";
export { buildBuilderSourceAccessRequests, writeBuilderSourceAccessRequests } from "./builderSourceAccessRequests.js";
export { parseExtractText, validateSanctionedBuilderExtract, validateSanctionedBuilderExtractFile } from "./builderSanctionedExtractValidation.js";
export {
  buildBuilderMemoryCards,
  buildBuilderDuplicateReviewQueue,
  buildBuilderSearchIndex,
  buildBuilderSourceAccessReport,
  combineLicenceRows,
  isBuilderLicenceClass,
  mapActProfessionalRow,
  mapNswContractorRow,
  mapNtBpbRow,
  mapQbccRow,
  mapVicBpcRow,
  mapWaBuilderRow,
  summarizeBuilderDataQuality,
  summarizeBuilderImport,
} from "./builderIngestion.js";
export {
  DEFAULT_CONVEX_BUILDER_BATCH_SIZE,
  UNKNOWN_POSTCODE_FACET,
  assertExpectedImportRows,
  assertExpectedImportTotals,
  artifactPaths,
  expectedConvexImportTotals,
  makeBuilderAbnLookupImportId,
  makeBuilderAbnMergeImportId,
  makeBuilderConvexImportId,
  makeBuilderDetailedListImportId,
  makeBuilderEnrichmentImportId,
  makeBuilderProductionReadinessImportId,
  makeBuilderWebsiteCandidateImportId,
  makeBuilderWebsiteCorroborationImportId,
  makeBuilderWebsiteUpdateProposalImportId,
  makeBuilderWebsiteDiscoveryImportId,
  makeBuilderWebsiteSearchRequestImportId,
  readBuilderAbnLookupConvexImportMetadata,
  readBuilderAbnMergeConvexImportMetadata,
  readBuilderDetailedListConvexImportMetadata,
  readBuilderEnrichmentConvexImportMetadata,
  readBuilderProductionReadinessConvexImportMetadata,
  readBuilderWebsiteCandidateConvexImportMetadata,
  readBuilderWebsiteCorroborationConvexImportMetadata,
  readBuilderWebsiteUpdateProposalConvexImportMetadata,
  readBuilderWebsiteDiscoveryConvexImportMetadata,
  readBuilderWebsiteSearchRequestConvexImportMetadata,
  readBuilderConvexImportMetadata,
  readNdjsonMappedBatches,
  toConvexBuilder,
  toConvexAbnLookupResult,
  toConvexAbnLookupRun,
  toConvexAbnMergeProposal,
  toConvexAbnMergeRun,
  toConvexDetailedListRow,
  toConvexDetailedListRun,
  toConvexDuplicateReview,
  toConvexEnrichmentJob,
  toConvexEnrichmentRun,
  toConvexWebsiteDiscoveryJob,
  toConvexWebsiteDiscoveryRun,
  toConvexWebsiteSearchRequest,
  toConvexWebsiteSearchRequestRun,
  toConvexWebsiteCandidate,
  toConvexWebsiteCandidateRun,
  toConvexWebsiteCorroboration,
  toConvexWebsiteCorroborationRun,
  toConvexWebsiteUpdateProposal,
  toConvexWebsiteUpdateProposalRun,
  toConvexImportRun,
  toConvexLicence,
  toConvexMemoryCard,
  toConvexProductionReadinessRun,
  toConvexSearchFacets,
  toConvexSourceAccessReport,
  verifyConvexAbnEvidenceRun,
  verifyConvexCoverageStatus,
  verifyConvexDetailedListRun,
  verifyConvexEnrichmentRun,
  verifyConvexWebsiteCandidateRun,
  verifyConvexWebsiteCorroborationRun,
  verifyConvexWebsiteUpdateProposalRun,
  verifyConvexWebsiteDiscoveryRun,
  verifyConvexWebsiteSearchRequestRun,
  verifyConvexImportRun,
  verifyConvexProductionReadinessRun,
} from "./builderConvexImport.js";
export { CONVEX_ARCHITECTURE_CONTRACT, DWELLA_TABLE_SCHEMAS } from "./schema.js";
export {
  AUSTRALIAN_CONTACT_ZONES,
  AUSTRALIAN_STATES,
  BUILDER_CONTACT_POLICY,
  BRIEF_FACT_FIELDS,
  LICENCE_SOURCES_BY_STATE,
} from "./policies.js";

export function createDwellaBackend(repo, options = {}) {
  const projects = createProjectsService(repo);
  const builders = createBuildersService(repo, { artifactDataDir: options.builderArtifactDataDir });
  const briefs = createBriefsService(repo);
  const documents = createDocumentsService(repo);
  const outreach = createOutreachService(repo, builders);
  const quotes = createQuotesService(repo);
  const agentRuns = createAgentRunsService(repo, { projects, builders, briefs, documents, outreach, quotes });

  return { projects, builders, briefs, documents, outreach, quotes, agentRuns };
}
