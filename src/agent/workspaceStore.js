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
    appendDocumentText(threadId, documentId, text) {
      return client.mutation(api.agentWorkspace.appendDocumentText, { threadId, documentId, text });
    },
    replaceDocumentText(threadId, documentId, text) {
      return client.mutation(api.agentWorkspace.replaceDocumentText, { threadId, documentId, text });
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
    generateConcepts(threadId, payload = {}) {
      const concepts = (Array.isArray(payload.concepts) ? payload.concepts : [])
        .map(sanitizeConceptInput)
        .filter(Boolean)
        .slice(0, 5);
      if (!concepts.length) return Promise.resolve(null);
      const args = { threadId, concepts };
      const briefSummary = String(payload.briefSummary ?? "").trim();
      if (briefSummary) args.briefSummary = briefSummary;
      const brief = sanitizeConceptBrief(payload.brief);
      if (brief) args.brief = brief;
      return client.action(api.conceptDesigner.generateConceptPackage, args);
    },
    async uploadDocumentAsset(threadId, file) {
      const uploadUrl = await client.mutation(api.agentWorkspace.generateDocumentAssetUploadUrl, { threadId });
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!uploadResponse.ok) {
        throw new Error("Document asset upload failed.");
      }
      const { storageId } = await uploadResponse.json();
      const result = await client.mutation(api.agentWorkspace.registerDocumentAsset, {
        threadId,
        storageId,
        name: file.name || "Document image",
        mimeType: file.type || "application/octet-stream",
        size: file.size,
      });
      return result;
    },
  };
}

function sanitizeConceptInput(concept) {
  const name = String(concept?.name ?? "").trim();
  const summary = String(concept?.summary ?? "").trim();
  if (!name || !summary) return null;
  const materials = (Array.isArray(concept?.materials) ? concept.materials : [])
    .map((material) => String(material ?? "").trim())
    .filter(Boolean)
    .slice(0, 8);
  const clean = {
    name,
    summary,
    style: String(concept?.style ?? "modern Australian").trim() || "modern Australian",
    storeys: Number.isFinite(Number(concept?.storeys)) ? Number(concept.storeys) : 1,
    materials: materials.length ? materials : ["metal roof", "fibre cement cladding"],
  };
  if (Number.isFinite(Number(concept?.bedrooms))) clean.bedrooms = Number(concept.bedrooms);
  if (Number.isFinite(Number(concept?.bathrooms))) clean.bathrooms = Number(concept.bathrooms);
  for (const key of ["roofForm", "keyIdea", "rationale"]) {
    const value = String(concept?.[key] ?? "").trim();
    if (value) clean[key] = value;
  }
  if (Array.isArray(concept?.riskFlags)) {
    const riskFlags = concept.riskFlags.map((flag) => String(flag ?? "").trim()).filter(Boolean).slice(0, 8);
    if (riskFlags.length) clean.riskFlags = riskFlags;
  }
  return clean;
}

function sanitizeConceptBrief(brief) {
  if (!brief || typeof brief !== "object") return null;
  const clean = {};
  for (const key of ["location", "stateOrTerritory", "landStatus", "budget", "household", "notes"]) {
    const value = String(brief[key] ?? "").trim();
    if (value) clean[key] = value;
  }
  for (const key of ["mustHaves", "avoid"]) {
    if (Array.isArray(brief[key])) {
      const values = brief[key].map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, 12);
      if (values.length) clean[key] = values;
    }
  }
  return Object.keys(clean).length ? clean : null;
}
