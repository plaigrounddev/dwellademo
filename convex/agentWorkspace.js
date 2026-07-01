import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_MAP_CENTER = { lat: -27.4698, lng: 153.0251 };
const DEFAULT_MAP_ZOOM = 12;

export const ensureThreadWorkspace = mutation({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
    await ensureBaseWorkspace(ctx, ownerTokenIdentifier, args.threadId);
    await ensureStarterDocument(ctx, ownerTokenIdentifier, args.threadId);
    return await readWorkspace(ctx, ownerTokenIdentifier, args.threadId);
  },
});

export const getWorkspace = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
    return await readWorkspace(ctx, ownerTokenIdentifier, args.threadId);
  },
});

export const createDocument = mutation({
  args: {
    threadId: v.string(),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
    await ensureBaseWorkspace(ctx, ownerTokenIdentifier, args.threadId);
    const now = Date.now();
    const title = cleanName(args.title, "Untitled document");
    const documentId = await ctx.db.insert("agentDocuments", {
      threadId: args.threadId,
      ownerTokenIdentifier,
      title,
      content: args.content ?? "",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("agentFiles", {
      threadId: args.threadId,
      ownerTokenIdentifier,
      key: `document:${documentId}`,
      parentKey: "documents",
      name: `${title}.md`,
      kind: "document",
      documentId,
      createdAt: now,
      updatedAt: now,
    });
    await patchThread(ctx, ownerTokenIdentifier, args.threadId, { activeDocumentId: documentId, updatedAt: now });
    return await readWorkspace(ctx, ownerTokenIdentifier, args.threadId);
  },
});

export const updateDocument = mutation({
  args: {
    threadId: v.string(),
    documentId: v.id("agentDocuments"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
    const document = await ctx.db.get(args.documentId);
    if (!document || document.threadId !== args.threadId || document.ownerTokenIdentifier !== ownerTokenIdentifier) {
      return await readWorkspace(ctx, ownerTokenIdentifier, args.threadId);
    }

    const now = Date.now();
    const patch = { updatedAt: now };
    if (args.title !== undefined) patch.title = cleanName(args.title, "Untitled document");
    if (args.content !== undefined) patch.content = args.content;
    await ctx.db.patch(args.documentId, patch);

    if (patch.title) {
      const file = await findFileByKey(ctx, ownerTokenIdentifier, args.threadId, `document:${args.documentId}`);
      if (file) {
        await ctx.db.patch(file._id, { name: `${patch.title}.md`, updatedAt: now });
      }
    }
    await patchThread(ctx, ownerTokenIdentifier, args.threadId, { activeDocumentId: args.documentId, updatedAt: now });
    return await readWorkspace(ctx, ownerTokenIdentifier, args.threadId);
  },
});

export const setActiveDocument = mutation({
  args: {
    threadId: v.string(),
    documentId: v.id("agentDocuments"),
  },
  handler: async (ctx, args) => {
    const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
    const document = await ctx.db.get(args.documentId);
    if (document?.threadId === args.threadId && document.ownerTokenIdentifier === ownerTokenIdentifier) {
      await patchThread(ctx, ownerTokenIdentifier, args.threadId, { activeDocumentId: args.documentId, updatedAt: Date.now() });
    }
    return await readWorkspace(ctx, ownerTokenIdentifier, args.threadId);
  },
});

export const createFolder = mutation({
  args: {
    threadId: v.string(),
    name: v.string(),
    parentKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
    await ensureBaseWorkspace(ctx, ownerTokenIdentifier, args.threadId);
    const now = Date.now();
    const name = cleanName(args.name, "New folder");
    await ctx.db.insert("agentFiles", {
      threadId: args.threadId,
      ownerTokenIdentifier,
      key: `folder:${now}`,
      parentKey: args.parentKey ?? "root",
      name,
      kind: "folder",
      createdAt: now,
      updatedAt: now,
    });
    await patchThread(ctx, ownerTokenIdentifier, args.threadId, { updatedAt: now });
    return await readWorkspace(ctx, ownerTokenIdentifier, args.threadId);
  },
});

export const createFile = mutation({
  args: {
    threadId: v.string(),
    name: v.string(),
    parentKey: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    size: v.optional(v.number()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
    await ensureBaseWorkspace(ctx, ownerTokenIdentifier, args.threadId);
    const now = Date.now();
    await ctx.db.insert("agentFiles", {
      threadId: args.threadId,
      ownerTokenIdentifier,
      key: `file:${now}`,
      parentKey: args.parentKey ?? "root",
      name: cleanName(args.name, "Untitled file"),
      kind: "file",
      ...(cleanOptionalString(args.mimeType) ? { mimeType: cleanOptionalString(args.mimeType) } : {}),
      ...(normalizeOptionalNumber(args.size) ? { size: normalizeOptionalNumber(args.size) } : {}),
      ...(cleanOptionalString(args.source) ? { source: cleanOptionalString(args.source) } : {}),
      createdAt: now,
      updatedAt: now,
    });
    await patchThread(ctx, ownerTokenIdentifier, args.threadId, { updatedAt: now });
    return await readWorkspace(ctx, ownerTokenIdentifier, args.threadId);
  },
});

export const updateMapView = mutation({
  args: {
    threadId: v.string(),
    center: v.object({ lat: v.number(), lng: v.number() }),
    zoom: v.number(),
  },
  handler: async (ctx, args) => {
    const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
    await ensureBaseWorkspace(ctx, ownerTokenIdentifier, args.threadId);
    await patchThread(ctx, ownerTokenIdentifier, args.threadId, {
      mapCenterLat: args.center.lat,
      mapCenterLng: args.center.lng,
      mapZoom: args.zoom,
      updatedAt: Date.now(),
    });
    return await readWorkspace(ctx, ownerTokenIdentifier, args.threadId);
  },
});

export const addMapMarker = mutation({
  args: {
    threadId: v.string(),
    label: v.string(),
    lat: v.number(),
    lng: v.number(),
  },
  handler: async (ctx, args) => {
    const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
    await ensureBaseWorkspace(ctx, ownerTokenIdentifier, args.threadId);
    await ctx.db.insert("agentMapMarkers", {
      threadId: args.threadId,
      ownerTokenIdentifier,
      label: cleanName(args.label, "Pin"),
      lat: args.lat,
      lng: args.lng,
      createdAt: Date.now(),
    });
    return await readWorkspace(ctx, ownerTokenIdentifier, args.threadId);
  },
});

export const clearMapMarkers = mutation({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
    const markers = await ctx.db
      .query("agentMapMarkers")
      .withIndex("by_ownerTokenIdentifier_and_threadId", (q) => q.eq("ownerTokenIdentifier", ownerTokenIdentifier).eq("threadId", args.threadId))
      .take(100);
    for (const marker of markers) {
      await ctx.db.delete(marker._id);
    }
    await ensureBaseWorkspace(ctx, ownerTokenIdentifier, args.threadId);
    await patchThread(ctx, ownerTokenIdentifier, args.threadId, {
      mapCenterLat: DEFAULT_MAP_CENTER.lat,
      mapCenterLng: DEFAULT_MAP_CENTER.lng,
      mapZoom: DEFAULT_MAP_ZOOM,
      updatedAt: Date.now(),
    });
    return await readWorkspace(ctx, ownerTokenIdentifier, args.threadId);
  },
});

export const updateBrowserUrl = mutation({
  args: {
    threadId: v.string(),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
    await ensureBaseWorkspace(ctx, ownerTokenIdentifier, args.threadId);
    await patchThread(ctx, ownerTokenIdentifier, args.threadId, { browserUrl: args.url || "about:blank", updatedAt: Date.now() });
    return await readWorkspace(ctx, ownerTokenIdentifier, args.threadId);
  },
});

async function ensureBaseWorkspace(ctx, ownerTokenIdentifier, threadId) {
  const now = Date.now();
  let thread = await findThread(ctx, ownerTokenIdentifier, threadId);
  if (!thread) {
    const threadRowId = await ctx.db.insert("agentThreads", {
      threadId,
      ownerTokenIdentifier,
      mapCenterLat: DEFAULT_MAP_CENTER.lat,
      mapCenterLng: DEFAULT_MAP_CENTER.lng,
      mapZoom: DEFAULT_MAP_ZOOM,
      browserUrl: "about:blank",
      createdAt: now,
      updatedAt: now,
    });
    thread = await ctx.db.get(threadRowId);
  }

  if (!(await findFileByKey(ctx, ownerTokenIdentifier, threadId, "root"))) {
    await ctx.db.insert("agentFiles", {
      threadId,
      ownerTokenIdentifier,
      key: "root",
      parentKey: "",
      name: "Thread files",
      kind: "folder",
      createdAt: now,
      updatedAt: now,
    });
  }

  if (!(await findFileByKey(ctx, ownerTokenIdentifier, threadId, "documents"))) {
    await ctx.db.insert("agentFiles", {
      threadId,
      ownerTokenIdentifier,
      key: "documents",
      parentKey: "root",
      name: "Documents",
      kind: "folder",
      createdAt: now,
      updatedAt: now,
    });
  }

  return thread;
}

async function ensureStarterDocument(ctx, ownerTokenIdentifier, threadId) {
  const documents = await ctx.db
    .query("agentDocuments")
    .withIndex("by_ownerTokenIdentifier_and_threadId", (q) => q.eq("ownerTokenIdentifier", ownerTokenIdentifier).eq("threadId", threadId))
    .take(1);
  if (documents.length) return documents[0];

  const now = Date.now();
  const documentId = await ctx.db.insert("agentDocuments", {
    threadId,
    ownerTokenIdentifier,
    title: "Untitled document",
    content: "",
    createdAt: now,
    updatedAt: now,
  });
  await ctx.db.insert("agentFiles", {
    threadId,
    ownerTokenIdentifier,
    key: `document:${documentId}`,
    parentKey: "documents",
    name: "Untitled document.md",
    kind: "document",
    documentId,
    createdAt: now,
    updatedAt: now,
  });
  await patchThread(ctx, ownerTokenIdentifier, threadId, { activeDocumentId: documentId, updatedAt: now });
  return await ctx.db.get(documentId);
}

async function readWorkspace(ctx, ownerTokenIdentifier, threadId) {
  const thread = await findThread(ctx, ownerTokenIdentifier, threadId);
  if (!thread) return null;

  const documents = await ctx.db
    .query("agentDocuments")
    .withIndex("by_ownerTokenIdentifier_and_threadId", (q) => q.eq("ownerTokenIdentifier", ownerTokenIdentifier).eq("threadId", threadId))
    .take(100);
  const files = await ctx.db
    .query("agentFiles")
    .withIndex("by_ownerTokenIdentifier_and_threadId", (q) => q.eq("ownerTokenIdentifier", ownerTokenIdentifier).eq("threadId", threadId))
    .take(200);
  const markers = await ctx.db
    .query("agentMapMarkers")
    .withIndex("by_ownerTokenIdentifier_and_threadId", (q) => q.eq("ownerTokenIdentifier", ownerTokenIdentifier).eq("threadId", threadId))
    .take(100);

  return {
    persistence: "convex",
    updatedAt: thread.updatedAt,
    activeDocumentId: thread.activeDocumentId ?? documents[0]?._id ?? null,
    documents: documents.map((document) => ({
      id: document._id,
      title: document.title,
      content: document.content,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      storage: "convex",
    })),
    folders: files
      .filter((file) => file.kind === "folder")
      .map((file) => ({
        id: file.key,
        name: file.name,
        parentId: file.parentKey || null,
        createdAt: file.createdAt,
      })),
    files: files
      .filter((file) => file.kind !== "folder")
      .map((file) => ({
        id: file.key,
        folderId: file.parentKey,
        name: file.name,
        type: file.kind,
        documentId: file.documentId ?? null,
        mimeType: file.mimeType ?? "",
        size: file.size ?? 0,
        source: file.source ?? "manual",
        updatedAt: file.updatedAt,
      })),
    map: {
      center: { lat: thread.mapCenterLat, lng: thread.mapCenterLng },
      zoom: thread.mapZoom,
      markers: markers.map((marker) => ({
        id: marker._id,
        label: marker.label,
        lat: marker.lat,
        lng: marker.lng,
      })),
    },
    browser: { url: thread.browserUrl },
  };
}

async function findThread(ctx, ownerTokenIdentifier, threadId) {
  return await ctx.db
    .query("agentThreads")
    .withIndex("by_ownerTokenIdentifier_and_threadId", (q) => q.eq("ownerTokenIdentifier", ownerTokenIdentifier).eq("threadId", threadId))
    .unique();
}

async function findFileByKey(ctx, ownerTokenIdentifier, threadId, key) {
  return await ctx.db
    .query("agentFiles")
    .withIndex("by_ownerTokenIdentifier_and_threadId_and_key", (q) =>
      q.eq("ownerTokenIdentifier", ownerTokenIdentifier).eq("threadId", threadId).eq("key", key)
    )
    .unique();
}

async function patchThread(ctx, ownerTokenIdentifier, threadId, patch) {
  const thread = await findThread(ctx, ownerTokenIdentifier, threadId);
  if (thread) await ctx.db.patch(thread._id, patch);
}

async function requireOwnerTokenIdentifier(ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.tokenIdentifier) {
    throw new Error("Not authenticated");
  }
  return identity.tokenIdentifier;
}

function cleanName(value, fallback) {
  const trimmed = String(value ?? "").trim();
  return trimmed || fallback;
}

function cleanOptionalString(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed || undefined;
}

function normalizeOptionalNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}
