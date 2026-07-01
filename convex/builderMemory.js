import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const evidenceQualityValidator = v.object({
  officialLicenceRecord: v.boolean(),
  businessIdentityMatched: v.boolean(),
  websiteEnriched: v.boolean(),
});

const sourceStatValidator = v.object({
  sourceId: v.string(),
  state: v.string(),
  rawRowsRead: v.number(),
  builderRowsAccepted: v.number(),
  totalAvailable: v.optional(v.number()),
  complete: v.boolean(),
  url: v.optional(v.string()),
});

const importTotalsValidator = v.object({
  builders: v.number(),
  licences: v.number(),
  memoryCards: v.number(),
  searchFacets: v.number(),
  duplicateReviews: v.number(),
});

const builderValidator = v.object({
  externalId: v.string(),
  name: v.string(),
  normalizedName: v.string(),
  tradingNames: v.array(v.string()),
  websiteUrl: v.optional(v.string()),
  abn: v.optional(v.string()),
  acn: v.optional(v.string()),
  states: v.array(v.string()),
  primaryState: v.string(),
  serviceRegions: v.array(v.string()),
  builderType: v.string(),
  homeTypes: v.array(v.string()),
  priceTier: v.string(),
  priceEvidence: v.optional(v.string()),
  status: v.string(),
  evidenceQuality: evidenceQualityValidator,
  sourceIds: v.array(v.string()),
  addresses: v.array(v.string()),
  lastEnrichedAt: v.optional(v.number()),
  artifactUpdatedAt: v.optional(v.number()),
});

const licenceValidator = v.object({
  externalId: v.string(),
  builderExternalId: v.string(),
  source: v.string(),
  sourceId: v.string(),
  state: v.string(),
  licenceNumber: v.string(),
  licenceClass: v.optional(v.string()),
  licenceType: v.optional(v.string()),
  status: v.optional(v.string()),
  restrictions: v.array(v.string()),
  rawSourceUrl: v.optional(v.string()),
  lastCheckedAt: v.number(),
  confidence: v.number(),
  address: v.optional(v.string()),
  postcode: v.optional(v.string()),
  issueDate: v.optional(v.string()),
  expiryDate: v.optional(v.string()),
  financialCategory: v.optional(v.string()),
  licenceGrade: v.optional(v.string()),
  firstNominatedSupervisor: v.optional(v.string()),
  formerRegistrationNumber: v.optional(v.string()),
});

const memoryCardValidator = v.object({
  externalId: v.string(),
  builderExternalId: v.string(),
  markdown: v.string(),
  searchableText: v.string(),
  sourceIds: v.array(v.string()),
  lastGeneratedAt: v.number(),
  confidence: v.number(),
  ragNamespace: v.string(),
  evidenceQuality: evidenceQualityValidator,
});

const searchFacetValidator = v.object({
  facetKey: v.string(),
  builderExternalId: v.string(),
  name: v.string(),
  searchableText: v.string(),
  state: v.string(),
  postcode: v.string(),
  sources: v.array(v.string()),
  licenceClasses: v.array(v.string()),
  licenceNumbers: v.array(v.string()),
  confidence: v.number(),
  evidenceQuality: evidenceQualityValidator,
  memoryCardExternalId: v.optional(v.string()),
});

const duplicateReviewValidator = v.object({
  externalId: v.string(),
  normalizedName: v.string(),
  displayNames: v.array(v.string()),
  reviewReason: v.string(),
  reviewOnly: v.boolean(),
  autoMerge: v.boolean(),
  confidence: v.string(),
  builderCount: v.number(),
  states: v.array(v.string()),
  builderIds: v.array(v.string()),
  sourceIds: v.array(v.string()),
  abns: v.array(v.string()),
  acns: v.array(v.string()),
  licenceCount: v.number(),
  notes: v.array(v.string()),
});

const enrichmentGapCountsValidator = v.object({
  businessIdentity: v.number(),
  websiteDiscovery: v.number(),
  websiteEnrichment: v.number(),
  serviceRegion: v.number(),
  address: v.number(),
});

const enrichmentSuggestedJobCountsValidator = v.object({
  abnLookupIdentityMatch: v.number(),
  officialWebsiteDiscovery: v.number(),
  websiteSummaryRefresh: v.number(),
  serviceRegionExtraction: v.number(),
  addressNormalisation: v.number(),
});

const enrichmentJobValidator = v.object({
  externalId: v.string(),
  builderExternalId: v.string(),
  name: v.string(),
  states: v.array(v.string()),
  primaryState: v.string(),
  sourceIds: v.array(v.string()),
  sourceManifestGeneratedAt: v.string(),
  generatedAt: v.string(),
  gaps: v.array(v.string()),
  gapKey: v.string(),
  hasBusinessIdentityGap: v.boolean(),
  hasWebsiteDiscoveryGap: v.boolean(),
  hasWebsiteEnrichmentGap: v.boolean(),
  hasServiceRegionGap: v.boolean(),
  hasAddressGap: v.boolean(),
  suggestedJobs: v.array(v.string()),
  suggestedJobKey: v.string(),
  hasAbnLookupIdentityMatchJob: v.boolean(),
  hasOfficialWebsiteDiscoveryJob: v.boolean(),
  hasWebsiteSummaryRefreshJob: v.boolean(),
  hasServiceRegionExtractionJob: v.boolean(),
  hasAddressNormalisationJob: v.boolean(),
  priorityScore: v.number(),
  reasons: v.array(v.string()),
  licenceCount: v.number(),
  licenceClasses: v.array(v.string()),
  licenceNumbers: v.array(v.string()),
  hasAbn: v.boolean(),
  hasAcn: v.boolean(),
  hasWebsite: v.boolean(),
  hasServiceRegions: v.boolean(),
  hasAddress: v.boolean(),
  evidenceQuality: evidenceQualityValidator,
  constraints: v.array(v.string()),
});

const websiteDiscoveryJobValidator = v.object({
  externalId: v.string(),
  builderExternalId: v.string(),
  enrichmentJobExternalId: v.string(),
  name: v.string(),
  states: v.array(v.string()),
  primaryState: v.string(),
  sourceIds: v.array(v.string()),
  sourceManifestGeneratedAt: v.string(),
  generatedAt: v.string(),
  searchQueries: v.array(v.string()),
  searchQueryCount: v.number(),
  maxResultsPerQuery: v.number(),
  excludedHosts: v.array(v.string()),
  priorityScore: v.number(),
  licenceCount: v.number(),
  licenceClasses: v.array(v.string()),
  licenceNumbers: v.array(v.string()),
  hasWebsite: v.boolean(),
  evidenceQuality: evidenceQualityValidator,
  constraints: v.array(v.string()),
});

const websiteSearchRequestValidator = v.object({
  externalId: v.string(),
  discoveryJobExternalId: v.string(),
  builderExternalId: v.string(),
  enrichmentJobExternalId: v.string(),
  builderName: v.string(),
  states: v.array(v.string()),
  primaryState: v.string(),
  sourceIds: v.array(v.string()),
  query: v.string(),
  maxResults: v.number(),
  excludedHosts: v.array(v.string()),
  licenceCount: v.number(),
  licenceNumbers: v.array(v.string()),
  licenceClasses: v.array(v.string()),
  hasWebsite: v.boolean(),
  evidenceQuality: evidenceQualityValidator,
  requestStatus: v.string(),
  constraints: v.array(v.string()),
});

const websiteCandidateTotalsValidator = v.object({
  discoveryJobs: v.number(),
  scannedResultRows: v.number(),
  expandedResults: v.number(),
  skippedResults: v.number(),
  writtenCandidates: v.number(),
});

const websiteCandidateValidator = v.object({
  externalId: v.string(),
  builderExternalId: v.string(),
  discoveryJobExternalId: v.string(),
  provider: v.string(),
  query: v.optional(v.string()),
  rank: v.optional(v.number()),
  builderName: v.string(),
  states: v.array(v.string()),
  primaryState: v.string(),
  sourceIds: v.array(v.string()),
  licenceNumbers: v.array(v.string()),
  licenceClasses: v.array(v.string()),
  url: v.string(),
  host: v.string(),
  title: v.optional(v.string()),
  snippet: v.optional(v.string()),
  candidateStatus: v.string(),
  reviewOnly: v.boolean(),
  autoApply: v.boolean(),
  score: v.number(),
  matchedNameTerms: v.array(v.string()),
  exclusionReason: v.optional(v.string()),
  evidenceJson: v.string(),
  constraints: v.array(v.string()),
});

const websiteCorroborationTotalsValidator = v.object({
  scannedCandidates: v.number(),
  eligibleCandidates: v.number(),
  fetchedCandidates: v.number(),
  corroboratedCandidates: v.number(),
});

const websiteCorroborationValidator = v.object({
  externalId: v.string(),
  candidateExternalId: v.string(),
  builderExternalId: v.string(),
  discoveryJobExternalId: v.string(),
  builderName: v.string(),
  states: v.array(v.string()),
  primaryState: v.string(),
  licenceNumbers: v.array(v.string()),
  licenceClasses: v.array(v.string()),
  url: v.string(),
  host: v.string(),
  provider: v.string(),
  searchRank: v.optional(v.number()),
  fetchStatus: v.string(),
  httpStatus: v.optional(v.number()),
  contentType: v.optional(v.string()),
  corroborationStatus: v.string(),
  reviewOnly: v.boolean(),
  autoApply: v.boolean(),
  score: v.number(),
  matchedNameTerms: v.array(v.string()),
  matchedLicenceNumbers: v.array(v.string()),
  matchedStates: v.array(v.string()),
  pageTextHash: v.string(),
  pageTextSample: v.optional(v.string()),
  constraints: v.array(v.string()),
});

const websiteUpdateProposalTotalsValidator = v.object({
  scannedCorroborations: v.number(),
  proposalRows: v.number(),
  proposedRows: v.number(),
  manualReviewRows: v.number(),
  notProposedRows: v.number(),
});

const websiteUpdateProposalValidator = v.object({
  externalId: v.string(),
  source: v.string(),
  corroborationExternalId: v.optional(v.string()),
  candidateExternalId: v.optional(v.string()),
  builderExternalId: v.optional(v.string()),
  discoveryJobExternalId: v.optional(v.string()),
  builderName: v.optional(v.string()),
  generatedAt: v.string(),
  proposalStatus: v.string(),
  proposalId: v.optional(v.string()),
  reason: v.optional(v.string()),
  confidence: v.optional(v.string()),
  url: v.optional(v.string()),
  host: v.optional(v.string()),
  reviewOnly: v.boolean(),
  autoApply: v.boolean(),
  proposedWebsiteUrl: v.optional(v.string()),
  proposedUpdatesJson: v.string(),
  evidenceJson: v.string(),
  limitations: v.array(v.string()),
  constraints: v.array(v.string()),
});

const detailedListTotalsValidator = v.object({
  builders: v.number(),
  licences: v.number(),
  sourceBuilders: v.number(),
  sourceLicences: v.number(),
});

const detailedListRowValidator = v.object({
  externalId: v.string(),
  name: v.string(),
  normalizedName: v.string(),
  tradingNames: v.array(v.string()),
  states: v.array(v.string()),
  primaryState: v.string(),
  status: v.string(),
  builderType: v.string(),
  homeTypes: v.array(v.string()),
  serviceRegions: v.array(v.string()),
  postcodes: v.array(v.string()),
  addresses: v.array(v.string()),
  websiteUrl: v.optional(v.string()),
  abn: v.optional(v.string()),
  acn: v.optional(v.string()),
  licenceCount: v.number(),
  licenceNumbers: v.array(v.string()),
  licenceClasses: v.array(v.string()),
  licenceTypes: v.array(v.string()),
  licenceStatuses: v.array(v.string()),
  licenceSources: v.array(v.string()),
  sourceIds: v.array(v.string()),
  rawSourceUrls: v.array(v.string()),
  lastCheckedAt: v.optional(v.string()),
  confidence: v.number(),
  officialLicenceRecord: v.boolean(),
  businessIdentityMatched: v.boolean(),
  websiteEnriched: v.boolean(),
  memoryCardExternalId: v.optional(v.string()),
  ragNamespace: v.string(),
  limitations: v.array(v.string()),
  evidenceNotes: v.array(v.string()),
  licencesJson: v.string(),
});

const abnLookupResultValidator = v.object({
  externalId: v.string(),
  status: v.string(),
  checkedAt: v.optional(v.string()),
  source: v.optional(v.string()),
  sourceUrl: v.optional(v.string()),
  builderExternalId: v.optional(v.string()),
  jobExternalId: v.optional(v.string()),
  queryName: v.optional(v.string()),
  responseMessage: v.optional(v.string()),
  candidateCount: v.number(),
  exactMatchCount: v.number(),
  candidatesJson: v.string(),
  exactMatchesJson: v.string(),
  reason: v.optional(v.string()),
  limitations: v.array(v.string()),
});

const abnMergeProposalValidator = v.object({
  externalId: v.string(),
  source: v.string(),
  sourceUrl: v.string(),
  builderExternalId: v.optional(v.string()),
  jobExternalId: v.optional(v.string()),
  queryName: v.optional(v.string()),
  checkedAt: v.optional(v.string()),
  generatedAt: v.string(),
  proposalStatus: v.string(),
  proposalId: v.optional(v.string()),
  reason: v.optional(v.string()),
  confidence: v.optional(v.string()),
  reviewOnly: v.boolean(),
  autoApply: v.boolean(),
  proposedAbn: v.optional(v.string()),
  proposedAcn: v.optional(v.string()),
  proposedUpdatesJson: v.string(),
  evidenceJson: v.string(),
  limitations: v.array(v.string()),
  constraints: v.array(v.string()),
});

const productionReadinessRunValidator = v.object({
  importId: v.string(),
  generatedAt: v.string(),
  status: v.string(),
  builders: v.number(),
  licences: v.number(),
  importedStates: v.array(v.string()),
  pendingStates: v.array(v.string()),
  detailedListRows: v.number(),
  memoryCards: v.number(),
  enrichmentJobs: v.number(),
  websiteDiscoveryJobs: v.number(),
  websiteSearchRequests: v.optional(v.number()),
  websiteCandidateRows: v.number(),
  websiteCorroborationRows: v.optional(v.number()),
  websiteCorroboratedRows: v.optional(v.number()),
  websiteUpdateProposalRows: v.optional(v.number()),
  websiteUpdateProposedRows: v.optional(v.number()),
  detailedListAuditStatus: v.optional(v.string()),
  detailedListAuditHardFailures: v.optional(v.number()),
  sourceAccessRequestRows: v.optional(v.number()),
  duplicateReviewRows: v.optional(v.number()),
  abnLookupRows: v.number(),
  abnMergeProposalRows: v.number(),
  blockerCount: v.number(),
  checksJson: v.string(),
  blockersJson: v.string(),
  evidenceCoverageJson: v.string(),
  limitations: v.array(v.string()),
  reportJson: v.string(),
});

export const upsertImportRun = mutation({
  args: {
    importId: v.string(),
    generatedAt: v.string(),
    importedStates: v.array(v.string()),
    pendingStates: v.array(v.string()),
    totals: v.object({
      builders: v.number(),
      licences: v.number(),
    }),
    expectedTotals: importTotalsValidator,
    sourceStats: v.array(sourceStatValidator),
    limitations: v.array(v.string()),
    artifactManifest: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await upsertByUniqueIndex(ctx, "builderImportRuns", "by_importId", "importId", args.importId, {
      ...args,
      importStatus: "started",
      updatedAt: now,
    });
  },
});

export const finalizeImportRun = mutation({
  args: {
    importId: v.string(),
    loadedTotals: importTotalsValidator,
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("builderImportRuns")
      .withIndex("by_importId", (q) => q.eq("importId", args.importId))
      .unique();
    if (!existing) {
      throw new Error(`Builder import run not found: ${args.importId}`);
    }
    assertLoadedTotals("Builder import", args.loadedTotals, existing.expectedTotals);
    const now = Date.now();
    await ctx.db.patch(existing._id, {
      loadedTotals: args.loadedTotals,
      importStatus: "completed",
      completedAt: now,
      updatedAt: now,
    });
    return { importId: args.importId, completedAt: now };
  },
});

export const upsertSourceAccessReport = mutation({
  args: {
    importId: v.string(),
    generatedAt: v.string(),
    importedStates: v.array(v.string()),
    pendingStates: v.array(v.string()),
    importedSourcesJson: v.string(),
    pendingSourcesJson: v.string(),
    rejectedCandidatesJson: v.string(),
    limitations: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await upsertByUniqueIndex(ctx, "builderSourceAccessReports", "by_importId", "importId", args.importId, {
      ...args,
      updatedAt: now,
    });
  },
});

export const upsertSourceAccessRecheck = mutation({
  args: {
    importId: v.string(),
    checkedAt: v.string(),
    pendingStates: v.array(v.string()),
    resultsJson: v.string(),
    limitations: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const recheckId = `${args.importId}:${args.checkedAt}`;
    return await upsertByUniqueIndex(ctx, "builderSourceAccessRechecks", "by_recheckId", "recheckId", recheckId, {
      recheckId,
      ...args,
      updatedAt: now,
    });
  },
});

export const upsertBuilderBatch = mutation({
  args: {
    importId: v.string(),
    builders: v.array(builderValidator),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let upserted = 0;
    for (const builder of args.builders) {
      await upsertByUniqueIndex(ctx, "builders", "by_externalId", "externalId", builder.externalId, {
        ...builder,
        importId: args.importId,
        updatedAt: now,
      });
      upserted += 1;
    }
    return { upserted };
  },
});

export const upsertLicenceBatch = mutation({
  args: {
    importId: v.string(),
    licences: v.array(licenceValidator),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let upserted = 0;
    for (const licence of args.licences) {
      await upsertByUniqueIndex(ctx, "builderLicences", "by_externalId", "externalId", licence.externalId, {
        ...licence,
        importId: args.importId,
        updatedAt: now,
      });
      upserted += 1;
    }
    return { upserted };
  },
});

export const upsertMemoryCardBatch = mutation({
  args: {
    importId: v.string(),
    memoryCards: v.array(memoryCardValidator),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let upserted = 0;
    for (const memoryCard of args.memoryCards) {
      await upsertByUniqueIndex(ctx, "builderMemoryCards", "by_externalId", "externalId", memoryCard.externalId, {
        ...memoryCard,
        importId: args.importId,
        updatedAt: now,
      });
      upserted += 1;
    }
    return { upserted };
  },
});

export const upsertSearchFacetBatch = mutation({
  args: {
    importId: v.string(),
    facets: v.array(searchFacetValidator),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let upserted = 0;
    for (const facet of args.facets) {
      await upsertByUniqueIndex(ctx, "builderSearchFacets", "by_facetKey", "facetKey", facet.facetKey, {
        ...facet,
        importId: args.importId,
        updatedAt: now,
      });
      upserted += 1;
    }
    return { upserted };
  },
});

export const upsertDuplicateReviewBatch = mutation({
  args: {
    importId: v.string(),
    duplicateReviews: v.array(duplicateReviewValidator),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let upserted = 0;
    for (const duplicateReview of args.duplicateReviews) {
      if (duplicateReview.reviewOnly !== true || duplicateReview.autoMerge !== false) {
        throw new Error("Duplicate reviews must remain reviewOnly=true and autoMerge=false.");
      }
      await upsertByUniqueIndex(ctx, "builderDuplicateReviews", "by_externalId", "externalId", duplicateReview.externalId, {
        ...duplicateReview,
        importId: args.importId,
        updatedAt: now,
      });
      upserted += 1;
    }
    return { upserted };
  },
});

export const upsertEnrichmentRun = mutation({
  args: {
    importId: v.string(),
    generatedAt: v.string(),
    sourceManifestGeneratedAt: v.string(),
    filterState: v.optional(v.string()),
    filterGap: v.optional(v.string()),
    totals: v.object({
      scannedBuilders: v.number(),
      matchingBuilders: v.number(),
      jobRows: v.number(),
      importedBuilders: v.number(),
      importedLicences: v.number(),
    }),
    gapCounts: enrichmentGapCountsValidator,
    suggestedJobCounts: enrichmentSuggestedJobCountsValidator,
    jobsSha256: v.string(),
    limitations: v.array(v.string()),
    summaryJson: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await upsertByUniqueIndex(ctx, "builderEnrichmentRuns", "by_importId", "importId", args.importId, {
      ...args,
      importStatus: "started",
      updatedAt: now,
    });
  },
});

export const finalizeEnrichmentRun = mutation({
  args: {
    importId: v.string(),
    loadedJobRows: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("builderEnrichmentRuns")
      .withIndex("by_importId", (q) => q.eq("importId", args.importId))
      .unique();
    if (!existing) {
      throw new Error(`Builder enrichment run not found: ${args.importId}`);
    }
    assertLoadedRows("Builder enrichment", args.loadedJobRows, existing.totals.jobRows);
    const now = Date.now();
    await ctx.db.patch(existing._id, {
      loadedJobRows: args.loadedJobRows,
      importStatus: "completed",
      completedAt: now,
      updatedAt: now,
    });
    return { importId: args.importId, completedAt: now };
  },
});

export const upsertEnrichmentJobBatch = mutation({
  args: {
    importId: v.string(),
    jobs: v.array(enrichmentJobValidator),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let upserted = 0;
    for (const job of args.jobs) {
      await upsertByUniqueIndex(ctx, "builderEnrichmentJobs", "by_externalId", "externalId", job.externalId, {
        ...job,
        importId: args.importId,
        updatedAt: now,
      });
      upserted += 1;
    }
    return { upserted };
  },
});

export const upsertWebsiteDiscoveryRun = mutation({
  args: {
    importId: v.string(),
    generatedAt: v.string(),
    sourceManifestGeneratedAt: v.string(),
    inputFile: v.string(),
    filterState: v.optional(v.string()),
    totals: v.object({
      scannedJobs: v.number(),
      eligibleJobs: v.number(),
      writtenJobs: v.number(),
      searchQueries: v.number(),
      importedBuilders: v.number(),
    }),
    byStateJson: v.string(),
    jobsSha256: v.string(),
    limitations: v.array(v.string()),
    summaryJson: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await upsertByUniqueIndex(ctx, "builderWebsiteDiscoveryRuns", "by_importId", "importId", args.importId, {
      ...args,
      importStatus: "started",
      updatedAt: now,
    });
  },
});

export const finalizeWebsiteDiscoveryRun = mutation({
  args: {
    importId: v.string(),
    loadedJobRows: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("builderWebsiteDiscoveryRuns")
      .withIndex("by_importId", (q) => q.eq("importId", args.importId))
      .unique();
    if (!existing) {
      throw new Error(`Builder website discovery run not found: ${args.importId}`);
    }
    assertLoadedRows("Builder website discovery", args.loadedJobRows, existing.totals.writtenJobs);
    const now = Date.now();
    await ctx.db.patch(existing._id, {
      loadedJobRows: args.loadedJobRows,
      importStatus: "completed",
      completedAt: now,
      updatedAt: now,
    });
    return { importId: args.importId, completedAt: now };
  },
});

export const upsertWebsiteDiscoveryJobBatch = mutation({
  args: {
    importId: v.string(),
    jobs: v.array(websiteDiscoveryJobValidator),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let upserted = 0;
    for (const job of args.jobs) {
      await upsertByUniqueIndex(ctx, "builderWebsiteDiscoveryJobs", "by_externalId", "externalId", job.externalId, {
        ...job,
        importId: args.importId,
        updatedAt: now,
      });
      upserted += 1;
    }
    return { upserted };
  },
});

export const upsertWebsiteSearchRequestRun = mutation({
  args: {
    importId: v.string(),
    generatedAt: v.string(),
    sourceManifestGeneratedAt: v.string(),
    inputFile: v.string(),
    totals: v.object({
      scannedJobs: v.number(),
      eligibleJobs: v.number(),
      writtenRequests: v.number(),
      importedBuilders: v.number(),
    }),
    byStateJson: v.string(),
    requestsSha256: v.string(),
    limitations: v.array(v.string()),
    summaryJson: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await upsertByUniqueIndex(ctx, "builderWebsiteSearchRequestRuns", "by_importId", "importId", args.importId, {
      ...args,
      importStatus: "started",
      updatedAt: now,
    });
  },
});

export const finalizeWebsiteSearchRequestRun = mutation({
  args: {
    importId: v.string(),
    loadedRows: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("builderWebsiteSearchRequestRuns")
      .withIndex("by_importId", (q) => q.eq("importId", args.importId))
      .unique();
    if (!existing) throw new Error(`Builder website search request run not found: ${args.importId}`);
    assertLoadedRows("Builder website search request", args.loadedRows, existing.totals.writtenRequests);
    const now = Date.now();
    await ctx.db.patch(existing._id, {
      loadedRows: args.loadedRows,
      importStatus: "completed",
      completedAt: now,
      updatedAt: now,
    });
    return { importId: args.importId, completedAt: now };
  },
});

export const upsertWebsiteSearchRequestBatch = mutation({
  args: {
    importId: v.string(),
    requests: v.array(websiteSearchRequestValidator),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let upserted = 0;
    for (const request of args.requests) {
      if (request.requestStatus !== "pending_search_provider") {
        throw new Error("Website search requests must remain pending_search_provider.");
      }
      await upsertByUniqueIndex(ctx, "builderWebsiteSearchRequests", "by_externalId", "externalId", request.externalId, {
        ...request,
        importId: args.importId,
        updatedAt: now,
      });
      upserted += 1;
    }
    return { upserted };
  },
});

export const upsertWebsiteCandidateRun = mutation({
  args: {
    importId: v.string(),
    generatedAt: v.string(),
    inputFile: v.string(),
    jobsFile: v.string(),
    totals: websiteCandidateTotalsValidator,
    candidatesSha256: v.string(),
    byStatusJson: v.string(),
    byProviderJson: v.string(),
    byStateJson: v.string(),
    limitations: v.array(v.string()),
    summaryJson: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await upsertByUniqueIndex(ctx, "builderWebsiteCandidateRuns", "by_importId", "importId", args.importId, {
      ...args,
      importStatus: "started",
      updatedAt: now,
    });
  },
});

export const finalizeWebsiteCandidateRun = mutation({
  args: {
    importId: v.string(),
    loadedRows: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("builderWebsiteCandidateRuns")
      .withIndex("by_importId", (q) => q.eq("importId", args.importId))
      .unique();
    if (!existing) {
      throw new Error(`Builder website candidate run not found: ${args.importId}`);
    }
    assertLoadedRows("Builder website candidate", args.loadedRows, existing.totals.writtenCandidates);
    const now = Date.now();
    await ctx.db.patch(existing._id, {
      loadedRows: args.loadedRows,
      importStatus: "completed",
      completedAt: now,
      updatedAt: now,
    });
    return { importId: args.importId, completedAt: now };
  },
});

export const upsertWebsiteCandidateBatch = mutation({
  args: {
    importId: v.string(),
    candidates: v.array(websiteCandidateValidator),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let upserted = 0;
    for (const candidate of args.candidates) {
      if (candidate.reviewOnly !== true || candidate.autoApply !== false) {
        throw new Error("Website candidates must remain reviewOnly=true and autoApply=false.");
      }
      await upsertByUniqueIndex(ctx, "builderWebsiteCandidates", "by_externalId", "externalId", candidate.externalId, {
        ...candidate,
        importId: args.importId,
        updatedAt: now,
      });
      upserted += 1;
    }
    return { upserted };
  },
});

export const upsertWebsiteCorroborationRun = mutation({
  args: {
    importId: v.string(),
    fetchedAt: v.string(),
    inputFile: v.string(),
    totals: websiteCorroborationTotalsValidator,
    corroborationSha256: v.string(),
    byStatusJson: v.string(),
    byStateJson: v.string(),
    limitations: v.array(v.string()),
    summaryJson: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await upsertByUniqueIndex(ctx, "builderWebsiteCorroborationRuns", "by_importId", "importId", args.importId, {
      ...args,
      importStatus: "started",
      updatedAt: now,
    });
  },
});

export const finalizeWebsiteCorroborationRun = mutation({
  args: {
    importId: v.string(),
    loadedRows: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("builderWebsiteCorroborationRuns")
      .withIndex("by_importId", (q) => q.eq("importId", args.importId))
      .unique();
    if (!existing) {
      throw new Error(`Builder website corroboration run not found: ${args.importId}`);
    }
    assertLoadedRows("Builder website corroboration", args.loadedRows, existing.totals.fetchedCandidates);
    const now = Date.now();
    await ctx.db.patch(existing._id, {
      loadedRows: args.loadedRows,
      importStatus: "completed",
      completedAt: now,
      updatedAt: now,
    });
    return { importId: args.importId, completedAt: now };
  },
});

export const upsertWebsiteCorroborationBatch = mutation({
  args: {
    importId: v.string(),
    corroborations: v.array(websiteCorroborationValidator),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let upserted = 0;
    for (const corroboration of args.corroborations) {
      if (corroboration.reviewOnly !== true || corroboration.autoApply !== false) {
        throw new Error("Website corroborations must remain reviewOnly=true and autoApply=false.");
      }
      await upsertByUniqueIndex(ctx, "builderWebsiteCorroborations", "by_externalId", "externalId", corroboration.externalId, {
        ...corroboration,
        importId: args.importId,
        updatedAt: now,
      });
      upserted += 1;
    }
    return { upserted };
  },
});

export const upsertWebsiteUpdateProposalRun = mutation({
  args: {
    importId: v.string(),
    generatedAt: v.string(),
    source: v.string(),
    inputFile: v.string(),
    outputFile: v.string(),
    totals: websiteUpdateProposalTotalsValidator,
    proposalsSha256: v.string(),
    limitations: v.array(v.string()),
    summaryJson: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await upsertByUniqueIndex(ctx, "builderWebsiteUpdateProposalRuns", "by_importId", "importId", args.importId, {
      ...args,
      importStatus: "started",
      updatedAt: now,
    });
  },
});

export const finalizeWebsiteUpdateProposalRun = mutation({
  args: {
    importId: v.string(),
    loadedRows: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("builderWebsiteUpdateProposalRuns")
      .withIndex("by_importId", (q) => q.eq("importId", args.importId))
      .unique();
    if (!existing) {
      throw new Error(`Builder website update proposal run not found: ${args.importId}`);
    }
    assertLoadedRows("Builder website update proposal", args.loadedRows, existing.totals.proposalRows);
    const now = Date.now();
    await ctx.db.patch(existing._id, {
      loadedRows: args.loadedRows,
      importStatus: "completed",
      completedAt: now,
      updatedAt: now,
    });
    return { importId: args.importId, completedAt: now };
  },
});

export const upsertWebsiteUpdateProposalBatch = mutation({
  args: {
    importId: v.string(),
    proposals: v.array(websiteUpdateProposalValidator),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let upserted = 0;
    for (const proposal of args.proposals) {
      if (proposal.reviewOnly !== true || proposal.autoApply !== false) {
        throw new Error("Website update proposals must remain reviewOnly=true and autoApply=false.");
      }
      if (proposal.source !== "WEBSITE_CORROBORATION") {
        throw new Error("Website update proposals must come from WEBSITE_CORROBORATION evidence.");
      }
      if (proposal.proposalStatus === "proposed" && !proposal.proposedWebsiteUrl) {
        throw new Error("Proposed website update rows must include proposedWebsiteUrl.");
      }
      if (proposal.proposalStatus !== "proposed" && proposal.proposedWebsiteUrl) {
        throw new Error("Manual-review website update rows must not include proposedWebsiteUrl.");
      }
      await upsertByUniqueIndex(ctx, "builderWebsiteUpdateProposals", "by_externalId", "externalId", proposal.externalId, {
        ...proposal,
        importId: args.importId,
        updatedAt: now,
      });
      upserted += 1;
    }
    return { upserted };
  },
});

export const upsertDetailedListRun = mutation({
  args: {
    importId: v.string(),
    generatedAt: v.string(),
    sourceManifestGeneratedAt: v.string(),
    sourceImportedStates: v.array(v.string()),
    sourcePendingStates: v.array(v.string()),
    totals: detailedListTotalsValidator,
    ndjsonSha256: v.string(),
    csvSha256: v.string(),
    byStateJson: v.string(),
    evidenceCountsJson: v.string(),
    limitationCountsJson: v.string(),
    limitations: v.array(v.string()),
    summaryJson: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await upsertByUniqueIndex(ctx, "builderDetailedListRuns", "by_importId", "importId", args.importId, {
      ...args,
      importStatus: "started",
      updatedAt: now,
    });
  },
});

export const finalizeDetailedListRun = mutation({
  args: {
    importId: v.string(),
    loadedRows: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("builderDetailedListRuns")
      .withIndex("by_importId", (q) => q.eq("importId", args.importId))
      .unique();
    if (!existing) {
      throw new Error(`Builder detailed list run not found: ${args.importId}`);
    }
    assertLoadedRows("Builder detailed list", args.loadedRows, existing.totals.builders);
    const now = Date.now();
    await ctx.db.patch(existing._id, {
      loadedRows: args.loadedRows,
      importStatus: "completed",
      completedAt: now,
      updatedAt: now,
    });
    return { importId: args.importId, completedAt: now };
  },
});

export const upsertDetailedListRowBatch = mutation({
  args: {
    importId: v.string(),
    rows: v.array(detailedListRowValidator),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let upserted = 0;
    for (const row of args.rows) {
      await upsertByUniqueIndex(ctx, "builderDetailedListRows", "by_externalId", "externalId", row.externalId, {
        ...row,
        importId: args.importId,
        updatedAt: now,
      });
      upserted += 1;
    }
    return { upserted };
  },
});

export const upsertAbnLookupRun = mutation({
  args: {
    importId: v.string(),
    checkedAt: v.string(),
    source: v.string(),
    sourceUrl: v.string(),
    scannedJobs: v.number(),
    eligibleJobs: v.number(),
    checkedJobs: v.number(),
    candidateCount: v.number(),
    exactMatchCount: v.number(),
    outputFile: v.string(),
    limitations: v.array(v.string()),
    summaryJson: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await upsertByUniqueIndex(ctx, "builderAbnLookupRuns", "by_importId", "importId", args.importId, {
      ...args,
      importStatus: "started",
      updatedAt: now,
    });
  },
});

export const finalizeAbnLookupRun = mutation({
  args: { importId: v.string(), loadedRows: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("builderAbnLookupRuns").withIndex("by_importId", (q) => q.eq("importId", args.importId)).unique();
    if (!existing) throw new Error(`Builder ABN lookup run not found: ${args.importId}`);
    assertLoadedRows("Builder ABN lookup", args.loadedRows, existing.checkedJobs);
    const now = Date.now();
    await ctx.db.patch(existing._id, { loadedRows: args.loadedRows, importStatus: "completed", completedAt: now, updatedAt: now });
    return { importId: args.importId, completedAt: now };
  },
});

export const upsertAbnLookupResultBatch = mutation({
  args: { importId: v.string(), results: v.array(abnLookupResultValidator) },
  handler: async (ctx, args) => {
    const now = Date.now();
    let upserted = 0;
    for (const result of args.results) {
      await upsertByUniqueIndex(ctx, "builderAbnLookupResults", "by_externalId", "externalId", result.externalId, {
        ...result,
        importId: args.importId,
        updatedAt: now,
      });
      upserted += 1;
    }
    return { upserted };
  },
});

export const upsertAbnMergeRun = mutation({
  args: {
    importId: v.string(),
    generatedAt: v.string(),
    source: v.string(),
    inputFile: v.string(),
    outputFile: v.string(),
    totals: v.object({
      scannedResults: v.number(),
      proposalRows: v.number(),
      proposedRows: v.number(),
      manualReviewRows: v.number(),
      notProposedRows: v.number(),
    }),
    proposalsSha256: v.string(),
    limitations: v.array(v.string()),
    summaryJson: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await upsertByUniqueIndex(ctx, "builderAbnMergeRuns", "by_importId", "importId", args.importId, {
      ...args,
      importStatus: "started",
      updatedAt: now,
    });
  },
});

export const finalizeAbnMergeRun = mutation({
  args: { importId: v.string(), loadedRows: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("builderAbnMergeRuns").withIndex("by_importId", (q) => q.eq("importId", args.importId)).unique();
    if (!existing) throw new Error(`Builder ABN merge run not found: ${args.importId}`);
    assertLoadedRows("Builder ABN merge", args.loadedRows, existing.totals.proposalRows);
    const now = Date.now();
    await ctx.db.patch(existing._id, { loadedRows: args.loadedRows, importStatus: "completed", completedAt: now, updatedAt: now });
    return { importId: args.importId, completedAt: now };
  },
});

export const upsertAbnMergeProposalBatch = mutation({
  args: { importId: v.string(), proposals: v.array(abnMergeProposalValidator) },
  handler: async (ctx, args) => {
    const now = Date.now();
    let upserted = 0;
    for (const proposal of args.proposals) {
      if (proposal.reviewOnly !== true || proposal.autoApply !== false) {
        throw new Error("ABN merge proposals must remain reviewOnly=true and autoApply=false.");
      }
      await upsertByUniqueIndex(ctx, "builderAbnMergeProposals", "by_externalId", "externalId", proposal.externalId, {
        ...proposal,
        importId: args.importId,
        updatedAt: now,
      });
      upserted += 1;
    }
    return { upserted };
  },
});

export const upsertProductionReadinessRun = mutation({
  args: productionReadinessRunValidator,
  handler: async (ctx, args) => {
    if (args.status === "production_ready" && args.blockerCount > 0) {
      throw new Error("Production readiness cannot be production_ready while blockers are present.");
    }
    const now = Date.now();
    return await upsertByUniqueIndex(ctx, "builderProductionReadinessRuns", "by_importId", "importId", args.importId, {
      ...args,
      importStatus: "started",
      updatedAt: now,
    });
  },
});

export const finalizeProductionReadinessRun = mutation({
  args: { importId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("builderProductionReadinessRuns")
      .withIndex("by_importId", (q) => q.eq("importId", args.importId))
      .unique();
    if (!existing) throw new Error(`Builder production readiness run not found: ${args.importId}`);
    const now = Date.now();
    await ctx.db.patch(existing._id, { importStatus: "completed", completedAt: now, updatedAt: now });
    return { importId: args.importId, completedAt: now };
  },
});

export const latestImportRun = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("builderImportRuns").withIndex("by_updatedAt").order("desc").first();
  },
});

export const getSourceAccessReport = query({
  args: {
    importId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const importId = args.importId ?? (await ctx.db.query("builderImportRuns").withIndex("by_updatedAt").order("desc").first())?.importId;
    if (!importId) return null;
    return await ctx.db
      .query("builderSourceAccessReports")
      .withIndex("by_importId", (q) => q.eq("importId", importId))
      .unique();
  },
});

export const latestSourceAccessRecheck = query({
  args: {
    importId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const latestImport = args.importId
      ? null
      : await ctx.db.query("builderImportRuns").withIndex("by_updatedAt").order("desc").first();
    const importId = args.importId ?? latestImport?.importId;
    if (!importId) return null;
    return await ctx.db
      .query("builderSourceAccessRechecks")
      .withIndex("by_importId_and_checkedAt", (q) => q.eq("importId", importId))
      .order("desc")
      .first();
  },
});

export const verifyImportRun = query({
  args: {
    importId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const importRun = args.importId
      ? await ctx.db
          .query("builderImportRuns")
          .withIndex("by_importId", (q) => q.eq("importId", args.importId))
          .unique()
      : await ctx.db.query("builderImportRuns").withIndex("by_updatedAt").order("desc").first();
    if (!importRun) {
      return {
        status: "missing",
        ok: false,
        failures: ["No builder import run found in Convex."],
      };
    }

    const sourceAccessReport = await ctx.db
      .query("builderSourceAccessReports")
      .withIndex("by_importId", (q) => q.eq("importId", importRun.importId))
      .unique();
    const sourceAccessRecheck = await ctx.db
      .query("builderSourceAccessRechecks")
      .withIndex("by_importId_and_checkedAt", (q) => q.eq("importId", importRun.importId))
      .order("desc")
      .first();
    const expectedTotals = importRun.expectedTotals ?? {
      builders: importRun.totals.builders,
      licences: importRun.totals.licences,
      memoryCards: 0,
      searchFacets: 0,
      duplicateReviews: 0,
    };
    const loadedTotals = importRun.loadedTotals ?? {
      builders: 0,
      licences: 0,
      memoryCards: 0,
      searchFacets: 0,
      duplicateReviews: 0,
    };
    const failures = [];

    if (importRun.importStatus !== "completed") failures.push("Import run is not marked completed.");
    for (const [key, expected] of Object.entries(expectedTotals)) {
      if (loadedTotals[key] !== expected) failures.push(`${key} loaded ${loadedTotals[key]} but expected ${expected}.`);
    }
    if (!sourceAccessReport) {
      failures.push("Source access report is missing.");
    } else {
      for (const state of importRun.pendingStates) {
        if (!sourceAccessReport.pendingStates.includes(state)) failures.push(`Pending state ${state} missing from source access report.`);
      }
    }
    if (!sourceAccessRecheck) {
      failures.push("Source access recheck is missing.");
    } else {
      for (const state of importRun.pendingStates) {
        if (!sourceAccessRecheck.pendingStates.includes(state)) failures.push(`Pending state ${state} missing from source access recheck.`);
      }
    }

    return {
      status: failures.length ? "mismatch" : "ok",
      ok: failures.length === 0,
      importId: importRun.importId,
      generatedAt: importRun.generatedAt,
      importedStates: importRun.importedStates,
      pendingStates: importRun.pendingStates,
      expectedTotals,
      loadedTotals,
      importStatus: importRun.importStatus ?? "started",
      completedAt: importRun.completedAt ?? null,
      sourceAccessReportPresent: Boolean(sourceAccessReport),
      sourceAccessRecheckPresent: Boolean(sourceAccessRecheck),
      sourceAccessRecheckCheckedAt: sourceAccessRecheck?.checkedAt ?? null,
      failures,
      limitations: importRun.limitations,
    };
  },
});

export const coverageStatus = query({
  args: {
    importId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const importRun = args.importId
      ? await ctx.db
          .query("builderImportRuns")
          .withIndex("by_importId", (q) => q.eq("importId", args.importId))
          .unique()
      : await ctx.db.query("builderImportRuns").withIndex("by_updatedAt").order("desc").first();
    if (!importRun) return null;

    const [sourceAccessReport, sourceAccessRecheck] = await Promise.all([
      ctx.db
        .query("builderSourceAccessReports")
        .withIndex("by_importId", (q) => q.eq("importId", importRun.importId))
        .unique(),
      ctx.db
        .query("builderSourceAccessRechecks")
        .withIndex("by_importId_and_checkedAt", (q) => q.eq("importId", importRun.importId))
        .order("desc")
        .first(),
    ]);
    const artifactManifest = parseJson(importRun.artifactManifest) ?? {};
    const pendingSources = parseJson(sourceAccessReport?.pendingSourcesJson) ?? [];
    const recheckResults = parseJson(sourceAccessRecheck?.resultsJson) ?? [];
    const importedStates = buildCoverageImportedStates(importRun, artifactManifest);
    const pendingStates = buildCoveragePendingStates(importRun.pendingStates, pendingSources, recheckResults);
    const limitations = uniqueStrings([
      "Coverage status describes Dwella's imported official builder evidence, not national completeness.",
      ...(importRun.limitations ?? []),
      ...(sourceAccessReport?.limitations ?? []),
      ...(sourceAccessRecheck?.limitations ?? []),
    ]);

    return {
      generatedAt: importRun.generatedAt ?? null,
      sourceAccessGeneratedAt: sourceAccessReport?.generatedAt ?? null,
      sourceAccessLastCheckedAt: sourceAccessRecheck?.checkedAt ?? null,
      importId: importRun.importId,
      importStatus: importRun.importStatus ?? "started",
      totals: {
        builders: importRun.loadedTotals?.builders ?? importRun.expectedTotals?.builders ?? importRun.totals?.builders ?? 0,
        licences: importRun.loadedTotals?.licences ?? importRun.expectedTotals?.licences ?? importRun.totals?.licences ?? 0,
        memoryCards: importRun.loadedTotals?.memoryCards ?? importRun.expectedTotals?.memoryCards ?? 0,
        searchFacets: importRun.loadedTotals?.searchFacets ?? importRun.expectedTotals?.searchFacets ?? 0,
        duplicateReviews: importRun.loadedTotals?.duplicateReviews ?? importRun.expectedTotals?.duplicateReviews ?? 0,
      },
      coverage: {
        importedStateCount: importedStates.length,
        pendingStateCount: pendingStates.length,
        importedStates: importedStates.map((state) => state.state),
        pendingStates: pendingStates.map((state) => state.state),
      },
      importedStates,
      pendingStates,
      limitations,
    };
  },
});

export const verifyEnrichmentRun = query({
  args: {
    importId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const run = args.importId
      ? await ctx.db
          .query("builderEnrichmentRuns")
          .withIndex("by_importId", (q) => q.eq("importId", args.importId))
          .unique()
      : await ctx.db.query("builderEnrichmentRuns").withIndex("by_updatedAt").order("desc").first();
    if (!run) {
      return {
        status: "missing",
        ok: false,
        failures: ["No builder enrichment run found in Convex."],
      };
    }

    const failures = [];
    if (run.importStatus !== "completed") failures.push("Enrichment run is not marked completed.");
    if (run.loadedJobRows !== run.totals.jobRows) {
      failures.push(`enrichment jobs loaded ${run.loadedJobRows ?? "missing"} but expected ${run.totals.jobRows}.`);
    }

    return {
      status: failures.length ? "mismatch" : "ok",
      ok: failures.length === 0,
      importId: run.importId,
      generatedAt: run.generatedAt,
      sourceManifestGeneratedAt: run.sourceManifestGeneratedAt,
      totals: run.totals,
      loadedJobRows: run.loadedJobRows ?? 0,
      gapCounts: run.gapCounts,
      suggestedJobCounts: run.suggestedJobCounts,
      jobsSha256: run.jobsSha256,
      importStatus: run.importStatus ?? "started",
      completedAt: run.completedAt ?? null,
      failures,
      limitations: run.limitations,
    };
  },
});

export const verifyWebsiteDiscoveryRun = query({
  args: {
    importId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const run = args.importId
      ? await ctx.db
          .query("builderWebsiteDiscoveryRuns")
          .withIndex("by_importId", (q) => q.eq("importId", args.importId))
          .unique()
      : await ctx.db.query("builderWebsiteDiscoveryRuns").withIndex("by_updatedAt").order("desc").first();
    if (!run) {
      return {
        status: "missing",
        ok: false,
        failures: ["No builder website discovery run found in Convex."],
      };
    }

    const failures = [];
    if (run.importStatus !== "completed") failures.push("Website discovery run is not marked completed.");
    if (run.loadedJobRows !== run.totals.writtenJobs) {
      failures.push(`website discovery jobs loaded ${run.loadedJobRows ?? "missing"} but expected ${run.totals.writtenJobs}.`);
    }

    return {
      status: failures.length ? "mismatch" : "ok",
      ok: failures.length === 0,
      importId: run.importId,
      generatedAt: run.generatedAt,
      sourceManifestGeneratedAt: run.sourceManifestGeneratedAt,
      totals: run.totals,
      loadedJobRows: run.loadedJobRows ?? 0,
      byState: parseJson(run.byStateJson) ?? {},
      jobsSha256: run.jobsSha256,
      importStatus: run.importStatus ?? "started",
      completedAt: run.completedAt ?? null,
      failures,
      limitations: run.limitations,
    };
  },
});

export const verifyWebsiteSearchRequestRun = query({
  args: {
    importId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const run = args.importId
      ? await ctx.db
          .query("builderWebsiteSearchRequestRuns")
          .withIndex("by_importId", (q) => q.eq("importId", args.importId))
          .unique()
      : await ctx.db.query("builderWebsiteSearchRequestRuns").withIndex("by_updatedAt").order("desc").first();
    if (!run) {
      return {
        status: "missing",
        ok: false,
        failures: ["No builder website search request run found in Convex."],
      };
    }

    const failures = [];
    if (run.importStatus !== "completed") failures.push("Website search request run is not marked completed.");
    if (run.loadedRows !== run.totals.writtenRequests) {
      failures.push(`website search requests loaded ${run.loadedRows ?? "missing"} but expected ${run.totals.writtenRequests}.`);
    }

    return {
      status: failures.length ? "mismatch" : "ok",
      ok: failures.length === 0,
      importId: run.importId,
      generatedAt: run.generatedAt,
      sourceManifestGeneratedAt: run.sourceManifestGeneratedAt,
      inputFile: run.inputFile,
      totals: run.totals,
      loadedRows: run.loadedRows ?? 0,
      byState: parseJson(run.byStateJson) ?? {},
      requestsSha256: run.requestsSha256,
      importStatus: run.importStatus ?? "started",
      completedAt: run.completedAt ?? null,
      failures,
      limitations: run.limitations,
    };
  },
});

export const verifyWebsiteCandidateRun = query({
  args: {
    importId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const run = args.importId
      ? await ctx.db
          .query("builderWebsiteCandidateRuns")
          .withIndex("by_importId", (q) => q.eq("importId", args.importId))
          .unique()
      : await ctx.db.query("builderWebsiteCandidateRuns").withIndex("by_updatedAt").order("desc").first();
    if (!run) {
      return {
        status: "missing",
        ok: false,
        failures: ["No builder website candidate run found in Convex."],
      };
    }

    const failures = [];
    if (run.importStatus !== "completed") failures.push("Website candidate run is not marked completed.");
    if (run.loadedRows !== run.totals.writtenCandidates) {
      failures.push(`website candidate rows loaded ${run.loadedRows ?? "missing"} but expected ${run.totals.writtenCandidates}.`);
    }

    return {
      status: failures.length ? "mismatch" : "ok",
      ok: failures.length === 0,
      importId: run.importId,
      generatedAt: run.generatedAt,
      inputFile: run.inputFile,
      jobsFile: run.jobsFile,
      totals: run.totals,
      loadedRows: run.loadedRows ?? 0,
      byStatus: parseJson(run.byStatusJson) ?? {},
      byProvider: parseJson(run.byProviderJson) ?? {},
      byState: parseJson(run.byStateJson) ?? {},
      candidatesSha256: run.candidatesSha256,
      importStatus: run.importStatus ?? "started",
      completedAt: run.completedAt ?? null,
      failures,
      limitations: run.limitations,
    };
  },
});

export const verifyWebsiteCorroborationRun = query({
  args: {
    importId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const run = args.importId
      ? await ctx.db
          .query("builderWebsiteCorroborationRuns")
          .withIndex("by_importId", (q) => q.eq("importId", args.importId))
          .unique()
      : await ctx.db.query("builderWebsiteCorroborationRuns").withIndex("by_updatedAt").order("desc").first();
    if (!run) {
      return {
        status: "missing",
        ok: false,
        failures: ["No builder website corroboration run found in Convex."],
      };
    }

    const failures = [];
    if (run.importStatus !== "completed") failures.push("Website corroboration run is not marked completed.");
    if (run.loadedRows !== run.totals.fetchedCandidates) {
      failures.push(`website corroboration rows loaded ${run.loadedRows ?? "missing"} but expected ${run.totals.fetchedCandidates}.`);
    }

    return {
      status: failures.length ? "mismatch" : "ok",
      ok: failures.length === 0,
      importId: run.importId,
      fetchedAt: run.fetchedAt,
      inputFile: run.inputFile,
      totals: run.totals,
      loadedRows: run.loadedRows ?? 0,
      byStatus: parseJson(run.byStatusJson) ?? {},
      byState: parseJson(run.byStateJson) ?? {},
      corroborationSha256: run.corroborationSha256,
      importStatus: run.importStatus ?? "started",
      completedAt: run.completedAt ?? null,
      failures,
      limitations: run.limitations,
    };
  },
});

export const verifyWebsiteUpdateProposalRun = query({
  args: {
    importId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const run = args.importId
      ? await ctx.db
          .query("builderWebsiteUpdateProposalRuns")
          .withIndex("by_importId", (q) => q.eq("importId", args.importId))
          .unique()
      : await ctx.db.query("builderWebsiteUpdateProposalRuns").withIndex("by_updatedAt").order("desc").first();
    if (!run) {
      return {
        status: "missing",
        ok: false,
        failures: ["No builder website update proposal run found in Convex."],
      };
    }

    const failures = [];
    if (run.importStatus !== "completed") failures.push("Website update proposal run is not marked completed.");
    if (run.loadedRows !== run.totals.proposalRows) {
      failures.push(`website update proposal rows loaded ${run.loadedRows ?? "missing"} but expected ${run.totals.proposalRows}.`);
    }

    return {
      status: failures.length ? "mismatch" : "ok",
      ok: failures.length === 0,
      importId: run.importId,
      generatedAt: run.generatedAt,
      source: run.source,
      inputFile: run.inputFile,
      outputFile: run.outputFile,
      totals: run.totals,
      loadedRows: run.loadedRows ?? 0,
      proposalsSha256: run.proposalsSha256,
      importStatus: run.importStatus ?? "started",
      completedAt: run.completedAt ?? null,
      failures,
      limitations: run.limitations,
    };
  },
});

export const verifyDetailedListRun = query({
  args: {
    importId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const run = args.importId
      ? await ctx.db
          .query("builderDetailedListRuns")
          .withIndex("by_importId", (q) => q.eq("importId", args.importId))
          .unique()
      : await ctx.db.query("builderDetailedListRuns").withIndex("by_updatedAt").order("desc").first();
    if (!run) {
      return {
        status: "missing",
        ok: false,
        failures: ["No builder detailed list run found in Convex."],
      };
    }

    const failures = [];
    if (run.importStatus !== "completed") failures.push("Detailed builder list run is not marked completed.");
    if (run.loadedRows !== run.totals.builders) {
      failures.push(`detailed builder rows loaded ${run.loadedRows ?? "missing"} but expected ${run.totals.builders}.`);
    }
    if (run.totals.sourceBuilders !== run.totals.builders) {
      failures.push(`detailed builder source count ${run.totals.sourceBuilders} does not match detailed rows ${run.totals.builders}.`);
    }
    if (run.totals.sourceLicences !== run.totals.licences) {
      failures.push(`detailed builder source licence count ${run.totals.sourceLicences} does not match detailed licences ${run.totals.licences}.`);
    }

    return {
      status: failures.length ? "mismatch" : "ok",
      ok: failures.length === 0,
      importId: run.importId,
      generatedAt: run.generatedAt,
      sourceManifestGeneratedAt: run.sourceManifestGeneratedAt,
      sourceImportedStates: run.sourceImportedStates,
      sourcePendingStates: run.sourcePendingStates,
      totals: run.totals,
      loadedRows: run.loadedRows ?? 0,
      byState: parseJson(run.byStateJson) ?? {},
      evidenceCounts: parseJson(run.evidenceCountsJson) ?? {},
      limitationCounts: parseJson(run.limitationCountsJson) ?? {},
      ndjsonSha256: run.ndjsonSha256,
      csvSha256: run.csvSha256,
      importStatus: run.importStatus ?? "started",
      completedAt: run.completedAt ?? null,
      failures,
      limitations: run.limitations,
    };
  },
});

export const verifyAbnLookupRun = query({
  args: { importId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const run = args.importId
      ? await ctx.db.query("builderAbnLookupRuns").withIndex("by_importId", (q) => q.eq("importId", args.importId)).unique()
      : await ctx.db.query("builderAbnLookupRuns").withIndex("by_updatedAt").order("desc").first();
    if (!run) return { status: "missing", ok: false, failures: ["No builder ABN lookup run found in Convex."] };
    const failures = [];
    if (run.importStatus !== "completed") failures.push("ABN lookup run is not marked completed.");
    if (run.loadedRows !== run.checkedJobs) failures.push(`ABN lookup rows loaded ${run.loadedRows ?? "missing"} but expected ${run.checkedJobs}.`);
    return {
      status: failures.length ? "mismatch" : "ok",
      ok: failures.length === 0,
      importId: run.importId,
      checkedAt: run.checkedAt,
      source: run.source,
      checkedJobs: run.checkedJobs,
      loadedRows: run.loadedRows ?? 0,
      candidateCount: run.candidateCount,
      exactMatchCount: run.exactMatchCount,
      importStatus: run.importStatus ?? "started",
      failures,
      limitations: run.limitations,
    };
  },
});

export const verifyAbnMergeRun = query({
  args: { importId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const run = args.importId
      ? await ctx.db.query("builderAbnMergeRuns").withIndex("by_importId", (q) => q.eq("importId", args.importId)).unique()
      : await ctx.db.query("builderAbnMergeRuns").withIndex("by_updatedAt").order("desc").first();
    if (!run) return { status: "missing", ok: false, failures: ["No builder ABN merge run found in Convex."] };
    const failures = [];
    if (run.importStatus !== "completed") failures.push("ABN merge run is not marked completed.");
    if (run.loadedRows !== run.totals.proposalRows) failures.push(`ABN merge proposal rows loaded ${run.loadedRows ?? "missing"} but expected ${run.totals.proposalRows}.`);
    return {
      status: failures.length ? "mismatch" : "ok",
      ok: failures.length === 0,
      importId: run.importId,
      generatedAt: run.generatedAt,
      source: run.source,
      totals: run.totals,
      loadedRows: run.loadedRows ?? 0,
      proposalsSha256: run.proposalsSha256,
      importStatus: run.importStatus ?? "started",
      failures,
      limitations: run.limitations,
    };
  },
});

export const verifyProductionReadinessRun = query({
  args: { importId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const run = args.importId
      ? await ctx.db
          .query("builderProductionReadinessRuns")
          .withIndex("by_importId", (q) => q.eq("importId", args.importId))
          .unique()
      : await ctx.db.query("builderProductionReadinessRuns").withIndex("by_updatedAt").order("desc").first();
    if (!run) return { status: "missing", ok: false, failures: ["No builder production readiness run found in Convex."] };

    const checks = parseJson(run.checksJson) ?? [];
    const blockers = parseJson(run.blockersJson) ?? [];
    const evidenceCoverage = parseJson(run.evidenceCoverageJson) ?? {};
    const failures = [];
    if (run.importStatus !== "completed") failures.push("Production readiness run is not marked completed.");
    if (run.status === "production_ready" && run.blockerCount > 0) failures.push("Production readiness is marked ready while blockers are present.");
    if (run.blockerCount !== blockers.length) failures.push(`production readiness blockerCount ${run.blockerCount} but parsed blockers ${blockers.length}.`);

    return {
      status: failures.length ? "mismatch" : "ok",
      ok: failures.length === 0,
      importId: run.importId,
      generatedAt: run.generatedAt,
      readinessStatus: run.status,
      summary: {
        builders: run.builders,
        licences: run.licences,
        importedStates: run.importedStates,
        pendingStates: run.pendingStates,
        detailedListRows: run.detailedListRows,
        memoryCards: run.memoryCards,
        enrichmentJobs: run.enrichmentJobs,
        websiteDiscoveryJobs: run.websiteDiscoveryJobs,
        websiteSearchRequests: run.websiteSearchRequests ?? 0,
        websiteCandidateRows: run.websiteCandidateRows,
        websiteCorroborationRows: run.websiteCorroborationRows ?? 0,
        websiteCorroboratedRows: run.websiteCorroboratedRows ?? 0,
        websiteUpdateProposalRows: run.websiteUpdateProposalRows ?? 0,
        websiteUpdateProposedRows: run.websiteUpdateProposedRows ?? 0,
        detailedListAuditStatus: run.detailedListAuditStatus ?? "missing",
        detailedListAuditHardFailures: run.detailedListAuditHardFailures ?? 0,
        sourceAccessRequestRows: run.sourceAccessRequestRows ?? 0,
        duplicateReviewRows: run.duplicateReviewRows ?? 0,
        abnLookupRows: run.abnLookupRows,
        abnMergeProposalRows: run.abnMergeProposalRows,
      },
      blockerCount: run.blockerCount,
      checks,
      blockers,
      evidenceCoverage,
      importStatus: run.importStatus ?? "started",
      completedAt: run.completedAt ?? null,
      failures,
      limitations: run.limitations,
    };
  },
});

export const searchEnrichmentJobs = query({
  args: {
    state: v.optional(v.string()),
    gap: v.optional(v.string()),
    suggestedJob: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit, 25, 100);
    const state = cleanState(args.state);
    const gap = clean(args.gap);
    const suggestedJob = clean(args.suggestedJob);
    let rows;

    if (suggestedJob && suggestedJobIndexName(suggestedJob)) {
      rows = await ctx.db
        .query("builderEnrichmentJobs")
        .withIndex(suggestedJobIndexName(suggestedJob), (q) => q.eq(suggestedJobBooleanField(suggestedJob), true))
        .order("desc")
        .take(limit * 3);
    } else if (gap && gapIndexName(gap)) {
      rows = await ctx.db
        .query("builderEnrichmentJobs")
        .withIndex(gapIndexName(gap), (q) => q.eq(gapBooleanField(gap), true))
        .order("desc")
        .take(limit * 3);
    } else if (state) {
      rows = await ctx.db
        .query("builderEnrichmentJobs")
        .withIndex("by_primaryState", (q) => q.eq("primaryState", state))
        .take(limit * 3);
    } else {
      rows = await ctx.db.query("builderEnrichmentJobs").take(limit);
    }

    const results = rows
      .filter((row) => !state || row.states.includes(state))
      .filter((row) => !gap || row.gaps.includes(gap))
      .filter((row) => !suggestedJob || row.suggestedJobs.includes(suggestedJob))
      .sort((a, b) => b.priorityScore - a.priorityScore || a.name.localeCompare(b.name))
      .slice(0, limit)
      .map((row) => ({
        jobId: row.externalId,
        builderId: row.builderExternalId,
        name: row.name,
        states: row.states,
        gaps: row.gaps,
        suggestedJobs: row.suggestedJobs,
        priorityScore: row.priorityScore,
        reasons: row.reasons,
        evidence: {
          licenceCount: row.licenceCount,
          licenceClasses: row.licenceClasses,
          licenceNumbers: row.licenceNumbers,
          hasAbn: row.hasAbn,
          hasAcn: row.hasAcn,
          hasWebsite: row.hasWebsite,
          hasServiceRegions: row.hasServiceRegions,
          hasAddress: row.hasAddress,
          evidenceQuality: row.evidenceQuality,
        },
        constraints: row.constraints,
      }));

    return {
      count: results.length,
      results,
      limitations: [
        "Enrichment jobs identify evidence gaps; they do not contain inferred ABNs, websites, service regions or addresses.",
        "Jobs should only be completed by production-safe integrations with recorded source evidence.",
      ],
    };
  },
});

export const searchWebsiteDiscoveryJobs = query({
  args: {
    state: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit, 25, 100);
    const state = cleanState(args.state);
    const rows = state
      ? await ctx.db
          .query("builderWebsiteDiscoveryJobs")
          .withIndex("by_primaryState", (q) => q.eq("primaryState", state))
          .take(limit * 3)
      : await ctx.db.query("builderWebsiteDiscoveryJobs").withIndex("by_priorityScore").order("desc").take(limit);

    const results = rows
      .filter((row) => !state || row.states.includes(state))
      .sort((a, b) => b.priorityScore - a.priorityScore || a.name.localeCompare(b.name))
      .slice(0, limit)
      .map((row) => ({
        discoveryJobId: row.externalId,
        builderId: row.builderExternalId,
        enrichmentJobId: row.enrichmentJobExternalId,
        name: row.name,
        states: row.states,
        sourceIds: row.sourceIds,
        searchQueries: row.searchQueries,
        maxResultsPerQuery: row.maxResultsPerQuery,
        excludedHosts: row.excludedHosts,
        priorityScore: row.priorityScore,
        evidence: {
          licenceCount: row.licenceCount,
          licenceClasses: row.licenceClasses,
          licenceNumbers: row.licenceNumbers,
          hasWebsite: row.hasWebsite,
          evidenceQuality: row.evidenceQuality,
        },
        constraints: row.constraints,
      }));

    return {
      count: results.length,
      results,
      limitations: [
        "Website discovery jobs contain search plans only; they do not contain verified builder website URLs.",
        "Persist website URLs only after a production search/fetch integration records corroborating source evidence.",
      ],
    };
  },
});

export const searchWebsiteSearchRequests = query({
  args: {
    state: v.optional(v.string()),
    requestStatus: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit, 25, 100);
    const state = cleanState(args.state);
    const requestStatus = clean(args.requestStatus) || "pending_search_provider";
    let rows;

    if (state) {
      rows = await ctx.db
        .query("builderWebsiteSearchRequests")
        .withIndex("by_requestStatus_and_primaryState", (q) => q.eq("requestStatus", requestStatus).eq("primaryState", state))
        .take(limit * 3);
    } else {
      rows = await ctx.db
        .query("builderWebsiteSearchRequests")
        .withIndex("by_requestStatus", (q) => q.eq("requestStatus", requestStatus))
        .take(limit);
    }

    const results = rows
      .filter((row) => !state || row.states.includes(state))
      .slice(0, limit)
      .map((row) => ({
        requestId: row.externalId,
        discoveryJobId: row.discoveryJobExternalId,
        builderId: row.builderExternalId,
        enrichmentJobId: row.enrichmentJobExternalId,
        builderName: row.builderName,
        states: row.states,
        primaryState: row.primaryState,
        sourceIds: row.sourceIds,
        query: row.query,
        maxResults: row.maxResults,
        excludedHosts: row.excludedHosts,
        requestStatus: row.requestStatus,
        evidence: {
          licenceCount: row.licenceCount,
          licenceClasses: row.licenceClasses,
          licenceNumbers: row.licenceNumbers,
          hasWebsite: row.hasWebsite,
          evidenceQuality: row.evidenceQuality,
        },
        constraints: row.constraints,
      }));

    return {
      count: results.length,
      results,
      limitations: [
        "Website search requests are provider work items only; they are not search results and contain no website URLs.",
        "Persist candidate URLs only from recorded production search-provider evidence consumed by the website candidate pipeline.",
      ],
    };
  },
});

export const searchWebsiteCandidates = query({
  args: {
    state: v.optional(v.string()),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit, 25, 100);
    const state = cleanState(args.state);
    const status = clean(args.status);
    let rows;

    if (status) {
      rows = await ctx.db
        .query("builderWebsiteCandidates")
        .withIndex("by_candidateStatus", (q) => q.eq("candidateStatus", status))
        .take(limit * 3);
    } else if (state) {
      rows = await ctx.db
        .query("builderWebsiteCandidates")
        .withIndex("by_primaryState", (q) => q.eq("primaryState", state))
        .take(limit * 3);
    } else {
      rows = await ctx.db.query("builderWebsiteCandidates").withIndex("by_score").order("desc").take(limit);
    }

    const results = rows
      .filter((row) => !state || row.states.includes(state))
      .filter((row) => !status || row.candidateStatus === status)
      .sort((a, b) => b.score - a.score || a.builderName.localeCompare(b.builderName))
      .slice(0, limit)
      .map((row) => ({
        candidateId: row.externalId,
        builderId: row.builderExternalId,
        discoveryJobId: row.discoveryJobExternalId,
        builderName: row.builderName,
        states: row.states,
        url: row.url,
        host: row.host,
        title: row.title ?? null,
        snippet: row.snippet ?? null,
        candidateStatus: row.candidateStatus,
        reviewOnly: row.reviewOnly,
        autoApply: row.autoApply,
        score: row.score,
        matchedNameTerms: row.matchedNameTerms,
        exclusionReason: row.exclusionReason ?? null,
        provider: row.provider,
        query: row.query ?? null,
        rank: row.rank ?? null,
        constraints: row.constraints,
      }));

    return {
      count: results.length,
      results,
      limitations: [
        "Website candidates are review-only search evidence and must not be auto-applied to builder records.",
        "Fetched-page corroboration is required before a URL can become a proposed builder website.",
      ],
    };
  },
});

export const searchWebsiteCorroborations = query({
  args: {
    state: v.optional(v.string()),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit, 25, 100);
    const state = cleanState(args.state);
    const status = clean(args.status);
    let rows;

    if (status) {
      rows = await ctx.db
        .query("builderWebsiteCorroborations")
        .withIndex("by_corroborationStatus", (q) => q.eq("corroborationStatus", status))
        .take(limit * 3);
    } else if (state) {
      rows = await ctx.db
        .query("builderWebsiteCorroborations")
        .withIndex("by_primaryState", (q) => q.eq("primaryState", state))
        .take(limit * 3);
    } else {
      rows = await ctx.db.query("builderWebsiteCorroborations").withIndex("by_score").order("desc").take(limit);
    }

    const results = rows
      .filter((row) => !state || row.states.includes(state))
      .filter((row) => !status || row.corroborationStatus === status)
      .sort((a, b) => b.score - a.score || a.builderName.localeCompare(b.builderName))
      .slice(0, limit)
      .map((row) => ({
        corroborationId: row.externalId,
        candidateId: row.candidateExternalId,
        builderId: row.builderExternalId,
        discoveryJobId: row.discoveryJobExternalId,
        builderName: row.builderName,
        states: row.states,
        url: row.url,
        host: row.host,
        fetchStatus: row.fetchStatus,
        httpStatus: row.httpStatus ?? null,
        corroborationStatus: row.corroborationStatus,
        reviewOnly: row.reviewOnly,
        autoApply: row.autoApply,
        score: row.score,
        matchedNameTerms: row.matchedNameTerms,
        matchedLicenceNumbers: row.matchedLicenceNumbers,
        matchedStates: row.matchedStates,
        pageTextHash: row.pageTextHash,
        provider: row.provider,
        searchRank: row.searchRank ?? null,
        constraints: row.constraints,
      }));

    return {
      count: results.length,
      results,
      limitations: [
        "Website corroborations are fetched-page review evidence and must not be auto-applied to builder records.",
        "Only corroborated rows may become review-only website update proposals.",
      ],
    };
  },
});

export const searchWebsiteUpdateProposals = query({
  args: {
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit, 25, 100);
    const status = clean(args.status);
    const rows = status
      ? await ctx.db.query("builderWebsiteUpdateProposals").withIndex("by_proposalStatus", (q) => q.eq("proposalStatus", status)).take(limit)
      : await ctx.db.query("builderWebsiteUpdateProposals").take(limit);
    return {
      count: rows.length,
      results: rows.map((row) => ({
        proposalId: row.externalId,
        builderId: row.builderExternalId ?? null,
        corroborationId: row.corroborationExternalId ?? null,
        candidateId: row.candidateExternalId ?? null,
        builderName: row.builderName ?? null,
        proposalStatus: row.proposalStatus,
        proposedUpdates: parseJson(row.proposedUpdatesJson) ?? {},
        confidence: row.confidence ?? null,
        reviewOnly: row.reviewOnly,
        autoApply: row.autoApply,
        reason: row.reason ?? null,
        evidence: parseJson(row.evidenceJson) ?? {},
        limitations: row.limitations,
      })),
      limitations: [
        "Website update proposals are review-only evidence records and must not be auto-applied.",
        "Reviewer approval is required before persisting websiteUrl values to builder records.",
      ],
    };
  },
});

export const searchAbnLookupResults = query({
  args: {
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit, 25, 100);
    const status = clean(args.status);
    const rows = status
      ? await ctx.db.query("builderAbnLookupResults").withIndex("by_status", (q) => q.eq("status", status)).take(limit)
      : await ctx.db.query("builderAbnLookupResults").take(limit);
    return {
      count: rows.length,
      results: rows.map((row) => ({
        resultId: row.externalId,
        builderId: row.builderExternalId ?? null,
        jobId: row.jobExternalId ?? null,
        status: row.status,
        checkedAt: row.checkedAt ?? null,
        source: row.source ?? null,
        sourceUrl: row.sourceUrl ?? null,
        queryName: row.queryName ?? null,
        responseMessage: row.responseMessage ?? null,
        candidateCount: row.candidateCount,
        exactMatchCount: row.exactMatchCount,
        candidates: parseJson(row.candidatesJson) ?? [],
        exactMatches: parseJson(row.exactMatchesJson) ?? [],
        reason: row.reason ?? null,
        limitations: row.limitations,
      })),
      limitations: [
        "ABN Lookup rows are credentialed evidence candidates and must not be auto-merged into builder records.",
        "Use review-only ABN merge proposals before persisting ABN/ACN identity fields.",
      ],
    };
  },
});

export const searchAbnMergeProposals = query({
  args: {
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit, 25, 100);
    const status = clean(args.status);
    const rows = status
      ? await ctx.db.query("builderAbnMergeProposals").withIndex("by_proposalStatus", (q) => q.eq("proposalStatus", status)).take(limit)
      : await ctx.db.query("builderAbnMergeProposals").take(limit);
    return {
      count: rows.length,
      results: rows.map((row) => ({
        proposalId: row.externalId,
        builderId: row.builderExternalId ?? null,
        jobId: row.jobExternalId ?? null,
        proposalStatus: row.proposalStatus,
        proposedUpdates: parseJson(row.proposedUpdatesJson) ?? {},
        confidence: row.confidence ?? null,
        reviewOnly: row.reviewOnly,
        autoApply: row.autoApply,
        reason: row.reason ?? null,
        limitations: row.limitations,
      })),
      limitations: [
        "ABN merge proposals are review-only evidence records and must not be auto-applied.",
        "Reviewer approval is required before persisting ABN/ACN values to builder records.",
      ],
    };
  },
});

export const searchBuilders = query({
  args: {
    query: v.optional(v.string()),
    state: v.optional(v.string()),
    postcode: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit, 25, 50);
    const searchText = clean(args.query);
    const state = cleanState(args.state);
    const postcode = clean(args.postcode);
    const facets = await searchBuilderFacets(ctx, { searchText, state, postcode, limit });
    const results = [];

    for (const facet of facets) {
      const builder = await ctx.db
        .query("builders")
        .withIndex("by_externalId", (q) => q.eq("externalId", facet.builderExternalId))
        .unique();
      if (!builder) continue;
      results.push({
        builderId: builder.externalId,
        name: builder.name,
        states: builder.states,
        postcodes: facet.postcode ? [facet.postcode] : [],
        licenceClasses: facet.licenceClasses,
        licenceNumbers: facet.licenceNumbers,
        sources: facet.sources,
        evidenceQuality: facet.evidenceQuality,
        confidence: facet.confidence,
        memoryCardId: facet.memoryCardExternalId ?? null,
        limitations: buildLimitations(builder),
      });
    }

    return {
      count: results.length,
      results,
      limitations: [
        "Search results are official licence evidence, not a guarantee of suitability, availability, insurance or quality.",
        "Website, pricing, capacity and quote behaviour stay unknown until evidence-backed enrichment runs.",
      ],
    };
  },
});

export const searchDetailedBuilders = query({
  args: {
    query: v.optional(v.string()),
    state: v.optional(v.string()),
    businessIdentityMatched: v.optional(v.boolean()),
    websiteEnriched: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit, 25, 50);
    const searchText = clean(args.query);
    const state = cleanState(args.state);
    let rows;

    if (searchText) {
      rows = await ctx.db
        .query("builderDetailedListRows")
        .withSearchIndex("search_name", (q) => {
          let queryBuilder = q.search("normalizedName", searchText);
          if (state) queryBuilder = queryBuilder.eq("primaryState", state);
          return queryBuilder;
        })
        .take(limit * 3);
    } else if (state) {
      rows = await ctx.db
        .query("builderDetailedListRows")
        .withIndex("by_primaryState", (q) => q.eq("primaryState", state))
        .take(limit * 3);
    } else if (typeof args.businessIdentityMatched === "boolean") {
      rows = await ctx.db
        .query("builderDetailedListRows")
        .withIndex("by_businessIdentityMatched", (q) => q.eq("businessIdentityMatched", args.businessIdentityMatched))
        .take(limit * 3);
    } else if (typeof args.websiteEnriched === "boolean") {
      rows = await ctx.db
        .query("builderDetailedListRows")
        .withIndex("by_websiteEnriched", (q) => q.eq("websiteEnriched", args.websiteEnriched))
        .take(limit * 3);
    } else {
      rows = await ctx.db.query("builderDetailedListRows").take(limit);
    }

    const results = rows
      .filter((row) => !state || row.states.includes(state))
      .filter((row) => typeof args.businessIdentityMatched !== "boolean" || row.businessIdentityMatched === args.businessIdentityMatched)
      .filter((row) => typeof args.websiteEnriched !== "boolean" || row.websiteEnriched === args.websiteEnriched)
      .sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name))
      .slice(0, limit)
      .map((row) => ({
        builderId: row.externalId,
        name: row.name,
        states: row.states,
        primaryState: row.primaryState,
        status: row.status,
        businessIdentity: { abn: row.abn ?? null, acn: row.acn ?? null, matched: row.businessIdentityMatched },
        website: { url: row.websiteUrl ?? null, enriched: row.websiteEnriched },
        serviceRegions: row.serviceRegions,
        postcodes: row.postcodes,
        licenceCount: row.licenceCount,
        licenceNumbers: row.licenceNumbers,
        licenceClasses: row.licenceClasses,
        sourceIds: row.sourceIds,
        rawSourceUrls: row.rawSourceUrls,
        confidence: row.confidence,
        memoryCardId: row.memoryCardExternalId ?? null,
        limitations: row.limitations,
        evidenceNotes: row.evidenceNotes,
      }));

    return {
      count: results.length,
      results,
      limitations: [
        "Detailed builder rows are imported evidence records, not recommendations or guarantees.",
        "Unknown website, pricing, capacity and quote behaviour fields remain unknown until evidence-backed enrichment runs.",
      ],
    };
  },
});

export const getBuilderEvidence = query({
  args: {
    builderId: v.string(),
  },
  handler: async (ctx, args) => {
    const builder = await ctx.db
      .query("builders")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.builderId))
      .unique();
    if (!builder) return null;

    const licences = await ctx.db
      .query("builderLicences")
      .withIndex("by_builderExternalId", (q) => q.eq("builderExternalId", args.builderId))
      .take(100);
    const memoryCard = await ctx.db
      .query("builderMemoryCards")
      .withIndex("by_builderExternalId", (q) => q.eq("builderExternalId", args.builderId))
      .first();

    return {
      builder,
      licences,
      memoryCard,
      evidenceQuality: builder.evidenceQuality,
      sourceIds: builder.sourceIds,
      limitations: buildLimitations(builder),
    };
  },
});

export const searchDuplicateReviews = query({
  args: {
    query: v.optional(v.string()),
    reviewReason: v.optional(v.string()),
    confidence: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit, 25, 50);
    const searchText = clean(args.query);
    const reviewReason = clean(args.reviewReason);
    const confidence = clean(args.confidence);
    let rows;

    if (searchText) {
      rows = await ctx.db
        .query("builderDuplicateReviews")
        .withSearchIndex("search_normalizedName", (q) => {
          let queryBuilder = q.search("normalizedName", searchText);
          if (reviewReason) queryBuilder = queryBuilder.eq("reviewReason", reviewReason);
          if (confidence) queryBuilder = queryBuilder.eq("confidence", confidence);
          return queryBuilder;
        })
        .take(limit);
    } else if (reviewReason) {
      rows = await ctx.db
        .query("builderDuplicateReviews")
        .withIndex("by_reviewReason", (q) => q.eq("reviewReason", reviewReason))
        .take(limit);
    } else if (confidence) {
      rows = await ctx.db
        .query("builderDuplicateReviews")
        .withIndex("by_confidence", (q) => q.eq("confidence", confidence))
        .take(limit);
    } else {
      rows = await ctx.db.query("builderDuplicateReviews").take(limit);
    }

    return {
      count: rows.length,
      results: rows.map((row) => ({
        id: row.externalId,
        normalizedName: row.normalizedName,
        displayNames: row.displayNames,
        reviewReason: row.reviewReason,
        reviewOnly: row.reviewOnly,
        autoMerge: row.autoMerge,
        confidence: row.confidence,
        builderCount: row.builderCount,
        states: row.states,
        builderIds: row.builderIds,
        sourceIds: row.sourceIds,
        businessNumbers: { abns: row.abns, acns: row.acns },
        licenceCount: row.licenceCount,
        notes: row.notes,
      })),
      limitations: [
        "Duplicate-review rows are same-name review candidates only.",
        "They are not automatic merges and are not proof that records belong to the same business.",
      ],
    };
  },
});

async function searchBuilderFacets(ctx, { searchText, state, postcode, limit }) {
  if (searchText) {
    return await ctx.db
      .query("builderSearchFacets")
      .withSearchIndex("search_searchableText", (q) => {
        let queryBuilder = q.search("searchableText", searchText);
        if (state) queryBuilder = queryBuilder.eq("state", state);
        if (postcode) queryBuilder = queryBuilder.eq("postcode", postcode);
        return queryBuilder;
      })
      .take(limit);
  }

  if (state && postcode) {
    return await ctx.db
      .query("builderSearchFacets")
      .withIndex("by_state_and_postcode", (q) => q.eq("state", state).eq("postcode", postcode))
      .take(limit);
  }

  if (state) {
    return await ctx.db
      .query("builderSearchFacets")
      .withIndex("by_state", (q) => q.eq("state", state))
      .take(limit);
  }

  return await ctx.db.query("builderSearchFacets").take(limit);
}

async function upsertByUniqueIndex(ctx, tableName, indexName, fieldName, value, patch) {
  const existing = await ctx.db
    .query(tableName)
    .withIndex(indexName, (q) => q.eq(fieldName, value))
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, patch);
    return existing._id;
  }
  return await ctx.db.insert(tableName, { ...patch, createdAt: Date.now() });
}

function buildLimitations(builder) {
  const limitations = [];
  if (!builder.websiteUrl) limitations.push("website not recorded");
  if (!builder.abn) limitations.push("ABN not recorded");
  if (!builder.serviceRegions.length) limitations.push("service regions not recorded");
  if (!builder.evidenceQuality.websiteEnriched) limitations.push("website, pricing, capacity and quote behaviour not enriched");
  return limitations;
}

function clean(value) {
  return String(value ?? "").trim();
}

function cleanState(value) {
  return clean(value).toUpperCase();
}

function clampLimit(value, fallback, maximum) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(Math.floor(value), maximum));
}

function buildCoverageImportedStates(importRun, artifactManifest) {
  const statsByState = new Map();
  for (const stat of importRun.sourceStats ?? []) {
    if (!stat.state) continue;
    const existing = statsByState.get(stat.state) ?? [];
    existing.push(stat);
    statsByState.set(stat.state, existing);
  }

  return (importRun.importedStates ?? []).map((state) => {
    const byState = artifactManifest?.byState?.[state] ?? {};
    const sourceStats = statsByState.get(state) ?? [];
    return {
      state,
      builders: byState.builders ?? sumRows(sourceStats, "builderRowsAccepted"),
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

function buildCoveragePendingStates(pendingStates, pendingSources, recheckResults) {
  const sourcesByState = new Map((pendingSources ?? []).map((source) => [source.state, source]));
  const recheckBySourceId = new Map((recheckResults ?? []).map((result) => [result.sourceId, result]));
  const states = uniqueStrings([...(pendingStates ?? []), ...(pendingSources ?? []).map((source) => source.state)]).sort();

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
      nextStep: nextStepForPendingCoverageSource(source, recheck),
    };
  });
}

function nextStepForPendingCoverageSource(source, recheck) {
  const status = clean(recheck?.observedAccessStatus ?? source?.accessStatus).toLowerCase();
  if (status.includes("recaptcha")) return "Request a sanctioned bulk extract, documented API or written permission before import.";
  if (status.includes("salesforce")) return "Identify a stable official extract/API or sanctioned server-side access path before import.";
  if (status.includes("cloudflare")) return "Use an official extract/API or owner-provided access path; do not bypass challenge controls.";
  return "Import only after a production-safe official extract, documented API or sanctioned access path is available.";
}

function parseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function sumRows(rows, key) {
  return rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
}

function assertLoadedRows(label, loadedRows, expectedRows) {
  if (loadedRows !== expectedRows) {
    throw new Error(`${label} loaded ${loadedRows} rows but expected ${expectedRows}; refusing to mark import completed.`);
  }
}

function assertLoadedTotals(label, loadedTotals, expectedTotals) {
  for (const [key, expected] of Object.entries(expectedTotals ?? {})) {
    const loaded = loadedTotals?.[key];
    if (loaded !== expected) {
      throw new Error(`${label} ${key} loaded ${loaded ?? "missing"} but expected ${expected}; refusing to mark import completed.`);
    }
  }
}

function gapBooleanField(gap) {
  if (gap === "business_identity") return "hasBusinessIdentityGap";
  if (gap === "website_discovery") return "hasWebsiteDiscoveryGap";
  if (gap === "website_enrichment") return "hasWebsiteEnrichmentGap";
  if (gap === "service_region") return "hasServiceRegionGap";
  if (gap === "address") return "hasAddressGap";
  return "hasBusinessIdentityGap";
}

function gapIndexName(gap) {
  if (gap === "business_identity") return "by_hasBusinessIdentityGap_and_priorityScore";
  if (gap === "website_discovery") return "by_hasWebsiteDiscoveryGap_and_priorityScore";
  if (gap === "website_enrichment") return "by_hasWebsiteEnrichmentGap_and_priorityScore";
  if (gap === "service_region") return "by_hasServiceRegionGap_and_priorityScore";
  if (gap === "address") return "by_hasAddressGap_and_priorityScore";
  return null;
}

function suggestedJobBooleanField(suggestedJob) {
  if (suggestedJob === "abn_lookup_identity_match") return "hasAbnLookupIdentityMatchJob";
  if (suggestedJob === "official_website_discovery") return "hasOfficialWebsiteDiscoveryJob";
  if (suggestedJob === "website_summary_refresh") return "hasWebsiteSummaryRefreshJob";
  if (suggestedJob === "service_region_extraction") return "hasServiceRegionExtractionJob";
  if (suggestedJob === "address_normalisation") return "hasAddressNormalisationJob";
  return "hasOfficialWebsiteDiscoveryJob";
}

function suggestedJobIndexName(suggestedJob) {
  if (suggestedJob === "abn_lookup_identity_match") return "by_hasAbnLookupIdentityMatchJob_and_priorityScore";
  if (suggestedJob === "official_website_discovery") return "by_hasOfficialWebsiteDiscoveryJob_and_priorityScore";
  if (suggestedJob === "website_summary_refresh") return "by_hasWebsiteSummaryRefreshJob_and_priorityScore";
  if (suggestedJob === "service_region_extraction") return "by_hasServiceRegionExtractionJob_and_priorityScore";
  if (suggestedJob === "address_normalisation") return "by_hasAddressNormalisationJob_and_priorityScore";
  return null;
}
