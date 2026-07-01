import { internal } from "./_generated/api";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";

export const getClientThread = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const durableThread = await findOwnedDurableThread(ctx, args.threadId);
    if (!durableThread) return null;
    return await ctx.runQuery(internal.dwellaAgentApi.getThread, {
      threadId: durableThread.agentThreadId,
    });
  },
});

export const listClientThreadMessages = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const durableThread = await findOwnedDurableThread(ctx, args.threadId);
    if (!durableThread) return [];
    return await ctx.runQuery(internal.dwellaAgentApi.listMessages, {
      threadId: durableThread.agentThreadId,
    });
  },
});

export const streamClientThreadUpdates = query({
  args: {
    threadId: v.string(),
    fromSeq: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const durableThread = await findOwnedDurableThread(ctx, args.threadId);
    if (!durableThread) return { messages: [] };
    return await ctx.runQuery(internal.dwellaAgentApi.streamUpdates, {
      threadId: durableThread.agentThreadId,
      fromSeq: args.fromSeq,
    });
  },
});

export const ensureDurableThread = internalMutation({
  args: { clientThreadId: v.string() },
  returns: v.object({
    clientThreadId: v.string(),
    agentThreadId: v.string(),
  }),
  handler: async (ctx, args) => {
    const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
    const clientThreadId = cleanThreadId(args.clientThreadId);
    const existing = await ctx.db
      .query("dwellaDurableThreads")
      .withIndex("by_ownerTokenIdentifier_and_clientThreadId", (q) =>
        q.eq("ownerTokenIdentifier", ownerTokenIdentifier).eq("clientThreadId", clientThreadId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { updatedAt: Date.now() });
      return {
        clientThreadId,
        agentThreadId: existing.agentThreadId,
      };
    }

    const agentThreadId = await ctx.runMutation(internal.dwellaAgentApi.createThread, {});
    const now = Date.now();
    await ctx.db.insert("dwellaDurableThreads", {
      clientThreadId,
      agentThreadId,
      ownerTokenIdentifier,
      createdAt: now,
      updatedAt: now,
    });

    return { clientThreadId, agentThreadId };
  },
});

export const getDurableThreadByClientThreadId = internalQuery({
  args: { clientThreadId: v.string() },
  returns: v.union(
    v.object({
      clientThreadId: v.string(),
      agentThreadId: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
    const clientThreadId = cleanThreadId(args.clientThreadId);
    const existing = await ctx.db
      .query("dwellaDurableThreads")
      .withIndex("by_ownerTokenIdentifier_and_clientThreadId", (q) =>
        q.eq("ownerTokenIdentifier", ownerTokenIdentifier).eq("clientThreadId", clientThreadId)
      )
      .unique();
    if (!existing) return null;
    return {
      clientThreadId,
      agentThreadId: existing.agentThreadId,
    };
  },
});

async function requireOwnerTokenIdentifier(ctx) {
  const ownerTokenIdentifier = await getOwnerTokenIdentifier(ctx);
  if (!ownerTokenIdentifier) {
    throw new Error("Not authenticated");
  }
  return ownerTokenIdentifier;
}

async function getOwnerTokenIdentifier(ctx) {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.tokenIdentifier ?? null;
}

async function findOwnedDurableThread(ctx, rawClientThreadId) {
  const ownerTokenIdentifier = await getOwnerTokenIdentifier(ctx);
  if (!ownerTokenIdentifier) return null;
  const clientThreadId = cleanThreadId(rawClientThreadId);
  return await ctx.db
    .query("dwellaDurableThreads")
    .withIndex("by_ownerTokenIdentifier_and_clientThreadId", (q) =>
      q.eq("ownerTokenIdentifier", ownerTokenIdentifier).eq("clientThreadId", clientThreadId)
    )
    .unique();
}

function cleanThreadId(threadId) {
  const trimmed = String(threadId ?? "").trim();
  return trimmed.slice(0, 160) || `thread-${Date.now().toString(36)}`;
}
