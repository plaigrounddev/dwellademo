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
});
