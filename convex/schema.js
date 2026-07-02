import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  dwellaDurableThreads: defineTable({
    clientThreadId: v.string(),
    agentThreadId: v.string(),
    ownerTokenIdentifier: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerTokenIdentifier_and_clientThreadId", ["ownerTokenIdentifier", "clientThreadId"])
    .index("by_agentThreadId", ["agentThreadId"]),

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

  agentConceptPackages: defineTable({
    threadId: v.string(),
    ownerTokenIdentifier: v.string(),
    briefSummary: v.string(),
    brief: v.object({
      location: v.optional(v.string()),
      stateOrTerritory: v.optional(v.string()),
      landStatus: v.optional(v.string()),
      budget: v.optional(v.string()),
      household: v.optional(v.string()),
      mustHaves: v.optional(v.array(v.string())),
      avoid: v.optional(v.array(v.string())),
      notes: v.optional(v.string()),
    }),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_ownerTokenIdentifier_and_threadId", ["ownerTokenIdentifier", "threadId"]),

  agentConceptOptions: defineTable({
    packageId: v.id("agentConceptPackages"),
    threadId: v.string(),
    ownerTokenIdentifier: v.string(),
    order: v.number(),
    name: v.string(),
    summary: v.string(),
    style: v.string(),
    storeys: v.number(),
    bedrooms: v.optional(v.number()),
    bathrooms: v.optional(v.number()),
    roofForm: v.optional(v.string()),
    materials: v.array(v.string()),
    keyIdea: v.optional(v.string()),
    rationale: v.optional(v.string()),
    riskFlags: v.optional(v.array(v.string())),
    status: v.union(v.literal("rendering"), v.literal("ready"), v.literal("failed")),
    colorStatus: v.optional(v.union(v.literal("rendering"), v.literal("ready"), v.literal("failed"))),
    floorPlanStatus: v.optional(v.union(v.literal("rendering"), v.literal("ready"), v.literal("failed"))),
    heroImageId: v.optional(v.id("_storage")),
    sketchImageId: v.optional(v.id("_storage")),
    floorPlanImageId: v.optional(v.id("_storage")),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_packageId", ["packageId"])
    .index("by_ownerTokenIdentifier_and_threadId", ["ownerTokenIdentifier", "threadId"]),

  agentConceptViews: defineTable({
    optionId: v.id("agentConceptOptions"),
    threadId: v.string(),
    ownerTokenIdentifier: v.string(),
    label: v.string(),
    request: v.string(),
    status: v.union(v.literal("rendering"), v.literal("ready"), v.literal("failed")),
    imageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_optionId", ["optionId"])
    .index("by_ownerTokenIdentifier_and_threadId", ["ownerTokenIdentifier", "threadId"]),

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
});
