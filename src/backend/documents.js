import { BackendError, assertRequired } from "./errors.js";
import { requireEntity } from "./utils.js";

export function createDocumentsService(repo) {
  function createUploadUrl(projectId, integrations = {}) {
    requireEntity(repo.get("projects", projectId), "projects", projectId);
    if (typeof integrations.createUploadUrl !== "function") {
      throw new BackendError("integration.missing", "createUploadUrl requires a storage integration");
    }
    return integrations.createUploadUrl({ projectId });
  }

  function list(projectId) {
    requireEntity(repo.get("projects", projectId), "projects", projectId);
    return repo.list("documents", (document) => document.projectId === projectId);
  }

  function register(projectId, document) {
    assertRequired(document?.name, "document.name");
    requireEntity(repo.get("projects", projectId), "projects", projectId);
    return repo.insert("documents", {
      projectId,
      name: document.name,
      type: document.type ?? "Other",
      status: document.status ?? "uploaded",
      notes: document.notes,
      storageId: document.storageId,
      approvedForSharing: false,
    });
  }

  async function extractFacts(documentId, integrations = {}) {
    const document = requireEntity(repo.get("documents", documentId), "documents", documentId);
    if (typeof integrations.extractFacts !== "function") {
      throw new BackendError("integration.missing", "extractFacts requires a document extraction integration");
    }
    const extractedFacts = await integrations.extractFacts(document);
    return repo.patch("documents", documentId, { extractedFacts });
  }

  function attachToBrief(projectId, documentId) {
    requireEntity(repo.get("projects", projectId), "projects", projectId);
    const document = requireEntity(repo.get("documents", documentId), "documents", documentId);
    if (document.projectId !== projectId) {
      throw new BackendError("validation.project_mismatch", "Document does not belong to project");
    }
    return repo.patch("documents", documentId, { attachedToBrief: true });
  }

  function approveForSharing(projectId, documentId) {
    requireEntity(repo.get("projects", projectId), "projects", projectId);
    const document = requireEntity(repo.get("documents", documentId), "documents", documentId);
    if (document.projectId !== projectId) {
      throw new BackendError("validation.project_mismatch", "Document does not belong to project");
    }
    return repo.patch("documents", documentId, { approvedForSharing: true, approvedForSharingAt: Date.now() });
  }

  return { createUploadUrl, list, register, extractFacts, attachToBrief, approveForSharing };
}
