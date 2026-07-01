import { ProsemirrorSync } from "@convex-dev/prosemirror-sync";
import { components } from "./_generated/api";
import { extractTextFromSnapshot } from "./richDocuments.js";

const prosemirrorSync = new ProsemirrorSync(components.prosemirrorSync);

export const {
  getSnapshot,
  submitSnapshot,
  latestVersion,
  getSteps,
  submitSteps,
} = prosemirrorSync.syncApi({
  checkRead: requireDocumentAccess,
  checkWrite: requireDocumentAccess,
  onSnapshot: updateDocumentExcerpt,
});

async function updateDocumentExcerpt(ctx, id, snapshot) {
  const document = await requireDocumentAccess(ctx, id);
  const text = extractTextFromSnapshot(snapshot);
  await ctx.db.patch(document._id, {
    content: text,
    updatedAt: Date.now(),
  });
}

async function requireDocumentAccess(ctx, id) {
  const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
  const documentId = ctx.db.normalizeId("agentDocuments", id);
  if (!documentId) {
    throw new Error("Document not found");
  }
  const document = await ctx.db.get(documentId);
  if (!document || document.ownerTokenIdentifier !== ownerTokenIdentifier) {
    throw new Error("Unauthorized");
  }
  return document;
}

async function requireOwnerTokenIdentifier(ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.tokenIdentifier) {
    throw new Error("Not authenticated");
  }
  return identity.tokenIdentifier;
}
