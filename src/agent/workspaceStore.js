import { api } from "../../convex/_generated/api.js";

export function createAgentWorkspaceStore(client) {
  if (!client) return null;

  return {
    ensureWorkspace(threadId) {
      return client.mutation(api.agentWorkspace.ensureThreadWorkspace, { threadId });
    },
    getWorkspace(threadId) {
      return client.query(api.agentWorkspace.getWorkspace, { threadId });
    },
    createDocument(threadId, title, content = "") {
      return client.mutation(api.agentWorkspace.createDocument, { threadId, title, content });
    },
    updateDocument(threadId, documentId, patch) {
      return client.mutation(api.agentWorkspace.updateDocument, { threadId, documentId, ...patch });
    },
    setActiveDocument(threadId, documentId) {
      return client.mutation(api.agentWorkspace.setActiveDocument, { threadId, documentId });
    },
    createFolder(threadId, name, parentKey = "root") {
      return client.mutation(api.agentWorkspace.createFolder, { threadId, name, parentKey });
    },
    createFile(threadId, input, parentKey = "root") {
      const fileInput = typeof input === "string" ? { name: input } : (input ?? {});
      const args = {
        threadId,
        name: String(fileInput.name ?? ""),
        parentKey,
      };
      const mimeType = String(fileInput.mimeType ?? fileInput.type ?? "").trim();
      const size = Number(fileInput.size);
      const source = String(fileInput.source ?? "").trim();
      if (mimeType) args.mimeType = mimeType;
      if (Number.isFinite(size) && size >= 0) args.size = size;
      if (source) args.source = source;
      return client.mutation(api.agentWorkspace.createFile, args);
    },
    updateMapView(threadId, center, zoom) {
      return client.mutation(api.agentWorkspace.updateMapView, { threadId, center, zoom });
    },
    addMapMarker(threadId, marker) {
      return client.mutation(api.agentWorkspace.addMapMarker, {
        threadId,
        label: marker.label,
        lat: marker.lat,
        lng: marker.lng,
      });
    },
    clearMapMarkers(threadId) {
      return client.mutation(api.agentWorkspace.clearMapMarkers, { threadId });
    },
    updateBrowserUrl(threadId, url) {
      return client.mutation(api.agentWorkspace.updateBrowserUrl, { threadId, url });
    },
  };
}
