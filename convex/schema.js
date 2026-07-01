import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  agentThreads: defineTable({
    threadId: v.string(),
    ownerTokenIdentifier: v.optional(v.string()),
    activeDocumentId: v.optional(v.id("agentDocuments")),
    mapCenterLat: v.number(),
    mapCenterLng: v.number(),
    mapZoom: v.number(),
    browserUrl: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_threadId", ["threadId"])
    .index("by_ownerTokenIdentifier_and_threadId", ["ownerTokenIdentifier", "threadId"]),

  agentDocuments: defineTable({
    threadId: v.string(),
    ownerTokenIdentifier: v.optional(v.string()),
    title: v.string(),
    content: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_threadId", ["threadId"])
    .index("by_ownerTokenIdentifier_and_threadId", ["ownerTokenIdentifier", "threadId"])
    .index("by_threadId_and_updatedAt", ["threadId", "updatedAt"]),

  agentFiles: defineTable({
    threadId: v.string(),
    ownerTokenIdentifier: v.optional(v.string()),
    key: v.string(),
    parentKey: v.string(),
    name: v.string(),
    kind: v.union(v.literal("folder"), v.literal("file"), v.literal("document")),
    documentId: v.optional(v.id("agentDocuments")),
    mimeType: v.optional(v.string()),
    size: v.optional(v.number()),
    source: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_threadId", ["threadId"])
    .index("by_ownerTokenIdentifier_and_threadId", ["ownerTokenIdentifier", "threadId"])
    .index("by_ownerTokenIdentifier_and_threadId_and_key", ["ownerTokenIdentifier", "threadId", "key"])
    .index("by_threadId_and_key", ["threadId", "key"])
    .index("by_threadId_and_parentKey", ["threadId", "parentKey"]),

  agentMapMarkers: defineTable({
    threadId: v.string(),
    ownerTokenIdentifier: v.optional(v.string()),
    label: v.string(),
    lat: v.number(),
    lng: v.number(),
    createdAt: v.number(),
  })
    .index("by_threadId", ["threadId"])
    .index("by_ownerTokenIdentifier_and_threadId", ["ownerTokenIdentifier", "threadId"]),

  builderImportRuns: defineTable({
    importId: v.string(),
    generatedAt: v.string(),
    importedStates: v.array(v.string()),
    pendingStates: v.array(v.string()),
    totals: v.object({
      builders: v.number(),
      licences: v.number(),
    }),
    expectedTotals: v.optional(
      v.object({
        builders: v.number(),
        licences: v.number(),
        memoryCards: v.number(),
        searchFacets: v.number(),
        duplicateReviews: v.number(),
      })
    ),
    loadedTotals: v.optional(
      v.object({
        builders: v.number(),
        licences: v.number(),
        memoryCards: v.number(),
        searchFacets: v.number(),
        duplicateReviews: v.number(),
      })
    ),
    importStatus: v.optional(v.union(v.literal("started"), v.literal("completed"))),
    completedAt: v.optional(v.number()),
    sourceStats: v.array(
      v.object({
        sourceId: v.string(),
        state: v.string(),
        rawRowsRead: v.number(),
        builderRowsAccepted: v.number(),
        totalAvailable: v.optional(v.number()),
        complete: v.boolean(),
        url: v.optional(v.string()),
      })
    ),
    limitations: v.array(v.string()),
    artifactManifest: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_importId", ["importId"])
    .index("by_updatedAt", ["updatedAt"]),

  builderSourceAccessReports: defineTable({
    importId: v.string(),
    generatedAt: v.string(),
    importedStates: v.array(v.string()),
    pendingStates: v.array(v.string()),
    importedSourcesJson: v.string(),
    pendingSourcesJson: v.string(),
    rejectedCandidatesJson: v.string(),
    limitations: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_importId", ["importId"]),

  builderSourceAccessRechecks: defineTable({
    recheckId: v.string(),
    importId: v.string(),
    checkedAt: v.string(),
    pendingStates: v.array(v.string()),
    resultsJson: v.string(),
    limitations: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_recheckId", ["recheckId"])
    .index("by_importId_and_checkedAt", ["importId", "checkedAt"])
    .index("by_updatedAt", ["updatedAt"]),

  builders: defineTable({
    externalId: v.string(),
    importId: v.string(),
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
    evidenceQuality: v.object({
      officialLicenceRecord: v.boolean(),
      businessIdentityMatched: v.boolean(),
      websiteEnriched: v.boolean(),
    }),
    sourceIds: v.array(v.string()),
    addresses: v.array(v.string()),
    lastEnrichedAt: v.optional(v.number()),
    artifactUpdatedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_externalId", ["externalId"])
    .index("by_importId", ["importId"])
    .index("by_primaryState", ["primaryState"])
    .searchIndex("search_name", {
      searchField: "normalizedName",
      filterFields: ["primaryState"],
    }),

  builderLicences: defineTable({
    externalId: v.string(),
    builderExternalId: v.string(),
    importId: v.string(),
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
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_externalId", ["externalId"])
    .index("by_builderExternalId", ["builderExternalId"])
    .index("by_state_and_licenceNumber", ["state", "licenceNumber"])
    .index("by_sourceId", ["sourceId"]),

  builderMemoryCards: defineTable({
    externalId: v.string(),
    builderExternalId: v.string(),
    importId: v.string(),
    markdown: v.string(),
    searchableText: v.string(),
    sourceIds: v.array(v.string()),
    lastGeneratedAt: v.number(),
    confidence: v.number(),
    ragNamespace: v.string(),
    evidenceQuality: v.object({
      officialLicenceRecord: v.boolean(),
      businessIdentityMatched: v.boolean(),
      websiteEnriched: v.boolean(),
    }),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_externalId", ["externalId"])
    .index("by_builderExternalId", ["builderExternalId"])
    .searchIndex("search_searchableText", {
      searchField: "searchableText",
      filterFields: ["ragNamespace"],
    }),

  builderSearchFacets: defineTable({
    facetKey: v.string(),
    builderExternalId: v.string(),
    importId: v.string(),
    name: v.string(),
    searchableText: v.string(),
    state: v.string(),
    postcode: v.string(),
    sources: v.array(v.string()),
    licenceClasses: v.array(v.string()),
    licenceNumbers: v.array(v.string()),
    confidence: v.number(),
    evidenceQuality: v.object({
      officialLicenceRecord: v.boolean(),
      businessIdentityMatched: v.boolean(),
      websiteEnriched: v.boolean(),
    }),
    memoryCardExternalId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_facetKey", ["facetKey"])
    .index("by_builderExternalId", ["builderExternalId"])
    .index("by_state", ["state"])
    .index("by_state_and_postcode", ["state", "postcode"])
    .searchIndex("search_searchableText", {
      searchField: "searchableText",
      filterFields: ["state", "postcode"],
    }),

  builderDuplicateReviews: defineTable({
    externalId: v.string(),
    importId: v.string(),
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
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_externalId", ["externalId"])
    .index("by_reviewReason", ["reviewReason"])
    .index("by_confidence", ["confidence"])
    .searchIndex("search_normalizedName", {
      searchField: "normalizedName",
      filterFields: ["reviewReason", "confidence"],
    }),

  builderEnrichmentRuns: defineTable({
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
    loadedJobRows: v.optional(v.number()),
    gapCounts: v.object({
      businessIdentity: v.number(),
      websiteDiscovery: v.number(),
      websiteEnrichment: v.number(),
      serviceRegion: v.number(),
      address: v.number(),
    }),
    suggestedJobCounts: v.object({
      abnLookupIdentityMatch: v.number(),
      officialWebsiteDiscovery: v.number(),
      websiteSummaryRefresh: v.number(),
      serviceRegionExtraction: v.number(),
      addressNormalisation: v.number(),
    }),
    jobsSha256: v.string(),
    importStatus: v.optional(v.union(v.literal("started"), v.literal("completed"))),
    completedAt: v.optional(v.number()),
    limitations: v.array(v.string()),
    summaryJson: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_importId", ["importId"])
    .index("by_updatedAt", ["updatedAt"]),

  builderEnrichmentJobs: defineTable({
    externalId: v.string(),
    importId: v.string(),
    builderExternalId: v.string(),
    name: v.string(),
    states: v.array(v.string()),
    primaryState: v.string(),
    sourceIds: v.array(v.string()),
    sourceManifestGeneratedAt: v.string(),
    generatedAt: v.string(),
    gaps: v.array(v.string()),
    gapKey: v.string(),
    hasBusinessIdentityGap: v.optional(v.boolean()),
    hasWebsiteDiscoveryGap: v.optional(v.boolean()),
    hasWebsiteEnrichmentGap: v.optional(v.boolean()),
    hasServiceRegionGap: v.optional(v.boolean()),
    hasAddressGap: v.optional(v.boolean()),
    suggestedJobs: v.array(v.string()),
    suggestedJobKey: v.string(),
    hasAbnLookupIdentityMatchJob: v.optional(v.boolean()),
    hasOfficialWebsiteDiscoveryJob: v.optional(v.boolean()),
    hasWebsiteSummaryRefreshJob: v.optional(v.boolean()),
    hasServiceRegionExtractionJob: v.optional(v.boolean()),
    hasAddressNormalisationJob: v.optional(v.boolean()),
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
    evidenceQuality: v.object({
      officialLicenceRecord: v.boolean(),
      businessIdentityMatched: v.boolean(),
      websiteEnriched: v.boolean(),
    }),
    constraints: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_externalId", ["externalId"])
    .index("by_importId", ["importId"])
    .index("by_primaryState", ["primaryState"])
    .index("by_gapKey_and_priorityScore", ["gapKey", "priorityScore"])
    .index("by_hasBusinessIdentityGap_and_priorityScore", ["hasBusinessIdentityGap", "priorityScore"])
    .index("by_hasWebsiteDiscoveryGap_and_priorityScore", ["hasWebsiteDiscoveryGap", "priorityScore"])
    .index("by_hasWebsiteEnrichmentGap_and_priorityScore", ["hasWebsiteEnrichmentGap", "priorityScore"])
    .index("by_hasServiceRegionGap_and_priorityScore", ["hasServiceRegionGap", "priorityScore"])
    .index("by_hasAddressGap_and_priorityScore", ["hasAddressGap", "priorityScore"])
    .index("by_suggestedJobKey_and_priorityScore", ["suggestedJobKey", "priorityScore"])
    .index("by_hasAbnLookupIdentityMatchJob_and_priorityScore", ["hasAbnLookupIdentityMatchJob", "priorityScore"])
    .index("by_hasOfficialWebsiteDiscoveryJob_and_priorityScore", ["hasOfficialWebsiteDiscoveryJob", "priorityScore"])
    .index("by_hasWebsiteSummaryRefreshJob_and_priorityScore", ["hasWebsiteSummaryRefreshJob", "priorityScore"])
    .index("by_hasServiceRegionExtractionJob_and_priorityScore", ["hasServiceRegionExtractionJob", "priorityScore"])
    .index("by_hasAddressNormalisationJob_and_priorityScore", ["hasAddressNormalisationJob", "priorityScore"]),

  builderWebsiteDiscoveryRuns: defineTable({
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
    loadedJobRows: v.optional(v.number()),
    byStateJson: v.string(),
    jobsSha256: v.string(),
    importStatus: v.optional(v.union(v.literal("started"), v.literal("completed"))),
    completedAt: v.optional(v.number()),
    limitations: v.array(v.string()),
    summaryJson: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_importId", ["importId"])
    .index("by_updatedAt", ["updatedAt"]),

  builderWebsiteDiscoveryJobs: defineTable({
    externalId: v.string(),
    importId: v.string(),
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
    evidenceQuality: v.object({
      officialLicenceRecord: v.boolean(),
      businessIdentityMatched: v.boolean(),
      websiteEnriched: v.boolean(),
    }),
    constraints: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_externalId", ["externalId"])
    .index("by_importId", ["importId"])
    .index("by_primaryState", ["primaryState"])
    .index("by_priorityScore", ["priorityScore"]),

  builderWebsiteSearchRequestRuns: defineTable({
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
    loadedRows: v.optional(v.number()),
    byStateJson: v.string(),
    requestsSha256: v.string(),
    importStatus: v.optional(v.union(v.literal("started"), v.literal("completed"))),
    completedAt: v.optional(v.number()),
    limitations: v.array(v.string()),
    summaryJson: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_importId", ["importId"])
    .index("by_updatedAt", ["updatedAt"]),

  builderWebsiteSearchRequests: defineTable({
    externalId: v.string(),
    importId: v.string(),
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
    evidenceQuality: v.object({
      officialLicenceRecord: v.boolean(),
      businessIdentityMatched: v.boolean(),
      websiteEnriched: v.boolean(),
    }),
    requestStatus: v.string(),
    constraints: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_externalId", ["externalId"])
    .index("by_importId", ["importId"])
    .index("by_builderExternalId", ["builderExternalId"])
    .index("by_discoveryJobExternalId", ["discoveryJobExternalId"])
    .index("by_primaryState", ["primaryState"])
    .index("by_requestStatus", ["requestStatus"])
    .index("by_requestStatus_and_primaryState", ["requestStatus", "primaryState"]),

  builderWebsiteCandidateRuns: defineTable({
    importId: v.string(),
    generatedAt: v.string(),
    inputFile: v.string(),
    jobsFile: v.string(),
    totals: v.object({
      discoveryJobs: v.number(),
      scannedResultRows: v.number(),
      expandedResults: v.number(),
      skippedResults: v.number(),
      writtenCandidates: v.number(),
    }),
    loadedRows: v.optional(v.number()),
    candidatesSha256: v.string(),
    byStatusJson: v.string(),
    byProviderJson: v.string(),
    byStateJson: v.string(),
    importStatus: v.optional(v.union(v.literal("started"), v.literal("completed"))),
    completedAt: v.optional(v.number()),
    limitations: v.array(v.string()),
    summaryJson: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_importId", ["importId"])
    .index("by_updatedAt", ["updatedAt"]),

  builderWebsiteCandidates: defineTable({
    externalId: v.string(),
    importId: v.string(),
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
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_externalId", ["externalId"])
    .index("by_importId", ["importId"])
    .index("by_builderExternalId", ["builderExternalId"])
    .index("by_primaryState", ["primaryState"])
    .index("by_candidateStatus", ["candidateStatus"])
    .index("by_score", ["score"]),

  builderWebsiteCorroborationRuns: defineTable({
    importId: v.string(),
    fetchedAt: v.string(),
    inputFile: v.string(),
    totals: v.object({
      scannedCandidates: v.number(),
      eligibleCandidates: v.number(),
      fetchedCandidates: v.number(),
      corroboratedCandidates: v.number(),
    }),
    loadedRows: v.optional(v.number()),
    corroborationSha256: v.string(),
    byStatusJson: v.string(),
    byStateJson: v.string(),
    importStatus: v.optional(v.union(v.literal("started"), v.literal("completed"))),
    completedAt: v.optional(v.number()),
    limitations: v.array(v.string()),
    summaryJson: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_importId", ["importId"])
    .index("by_updatedAt", ["updatedAt"]),

  builderWebsiteCorroborations: defineTable({
    externalId: v.string(),
    importId: v.string(),
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
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_externalId", ["externalId"])
    .index("by_importId", ["importId"])
    .index("by_candidateExternalId", ["candidateExternalId"])
    .index("by_builderExternalId", ["builderExternalId"])
    .index("by_primaryState", ["primaryState"])
    .index("by_corroborationStatus", ["corroborationStatus"])
    .index("by_score", ["score"]),

  builderWebsiteUpdateProposalRuns: defineTable({
    importId: v.string(),
    generatedAt: v.string(),
    source: v.string(),
    inputFile: v.string(),
    outputFile: v.string(),
    totals: v.object({
      scannedCorroborations: v.number(),
      proposalRows: v.number(),
      proposedRows: v.number(),
      manualReviewRows: v.number(),
      notProposedRows: v.number(),
    }),
    loadedRows: v.optional(v.number()),
    proposalsSha256: v.string(),
    importStatus: v.optional(v.union(v.literal("started"), v.literal("completed"))),
    completedAt: v.optional(v.number()),
    limitations: v.array(v.string()),
    summaryJson: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_importId", ["importId"])
    .index("by_updatedAt", ["updatedAt"]),

  builderWebsiteUpdateProposals: defineTable({
    externalId: v.string(),
    importId: v.string(),
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
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_externalId", ["externalId"])
    .index("by_importId", ["importId"])
    .index("by_builderExternalId", ["builderExternalId"])
    .index("by_proposalStatus", ["proposalStatus"]),

  builderAbnLookupRuns: defineTable({
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
    loadedRows: v.optional(v.number()),
    importStatus: v.optional(v.union(v.literal("started"), v.literal("completed"))),
    completedAt: v.optional(v.number()),
    limitations: v.array(v.string()),
    summaryJson: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_importId", ["importId"])
    .index("by_updatedAt", ["updatedAt"]),

  builderAbnLookupResults: defineTable({
    externalId: v.string(),
    importId: v.string(),
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
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_externalId", ["externalId"])
    .index("by_importId", ["importId"])
    .index("by_builderExternalId", ["builderExternalId"])
    .index("by_status", ["status"]),

  builderAbnMergeRuns: defineTable({
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
    loadedRows: v.optional(v.number()),
    proposalsSha256: v.string(),
    importStatus: v.optional(v.union(v.literal("started"), v.literal("completed"))),
    completedAt: v.optional(v.number()),
    limitations: v.array(v.string()),
    summaryJson: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_importId", ["importId"])
    .index("by_updatedAt", ["updatedAt"]),

  builderAbnMergeProposals: defineTable({
    externalId: v.string(),
    importId: v.string(),
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
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_externalId", ["externalId"])
    .index("by_importId", ["importId"])
    .index("by_builderExternalId", ["builderExternalId"])
    .index("by_proposalStatus", ["proposalStatus"]),

  builderProductionReadinessRuns: defineTable({
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
    importStatus: v.optional(v.union(v.literal("started"), v.literal("completed"))),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_importId", ["importId"])
    .index("by_status", ["status"])
    .index("by_updatedAt", ["updatedAt"]),

  builderDetailedListRuns: defineTable({
    importId: v.string(),
    generatedAt: v.string(),
    sourceManifestGeneratedAt: v.string(),
    sourceImportedStates: v.array(v.string()),
    sourcePendingStates: v.array(v.string()),
    totals: v.object({
      builders: v.number(),
      licences: v.number(),
      sourceBuilders: v.number(),
      sourceLicences: v.number(),
    }),
    loadedRows: v.optional(v.number()),
    ndjsonSha256: v.string(),
    csvSha256: v.string(),
    byStateJson: v.string(),
    evidenceCountsJson: v.string(),
    limitationCountsJson: v.string(),
    importStatus: v.optional(v.union(v.literal("started"), v.literal("completed"))),
    completedAt: v.optional(v.number()),
    limitations: v.array(v.string()),
    summaryJson: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_importId", ["importId"])
    .index("by_updatedAt", ["updatedAt"]),

  builderDetailedListRows: defineTable({
    externalId: v.string(),
    importId: v.string(),
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
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_externalId", ["externalId"])
    .index("by_importId", ["importId"])
    .index("by_primaryState", ["primaryState"])
    .index("by_businessIdentityMatched", ["businessIdentityMatched"])
    .index("by_websiteEnriched", ["websiteEnriched"])
    .searchIndex("search_name", {
      searchField: "normalizedName",
      filterFields: ["primaryState"],
    }),
});
