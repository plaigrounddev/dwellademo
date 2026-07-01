export function createDwellaAgentClient({ endpoint, fetcher = fetch, storage = defaultStorage(), getAuthToken = null } = {}) {
  const baseEndpoint = String(endpoint ?? "").trim().replace(/\/$/, "");
  if (!baseEndpoint) {
    throw new TypeError("Dwella agent endpoint is required.");
  }
  const threadKey = "dwella.agent.threadId";
  const continuationKey = (threadId) => `dwella.agent.continuationToken.${threadId}`;

  function getOrCreateThread() {
    const existing = storage.getItem(threadKey);
    if (existing) return { id: existing, status: "active" };
    const id = `thread-${Date.now().toString(36)}`;
    storage.setItem(threadKey, id);
    return { id, status: "active" };
  }

  async function sendTextMessage({ threadId, message, history = [], attachments = [], workspaceContext = null }) {
    const trimmed = String(message ?? "").trim();
    if (!trimmed) {
      return { status: "empty", message: null };
    }

    try {
      const normalizedAttachments = normalizeAttachments(attachments);
      const uploadFiles = typeof File !== "undefined"
        ? normalizedAttachments.filter((attachment) => attachment.file instanceof File)
        : [];
      const continuationToken = getContinuationToken(threadId);
      const response = uploadFiles.length
        ? await fetcher(`${baseEndpoint}/runs`, {
            method: "POST",
            headers: await createAuthHeaders(),
            body: createRunFormData({ threadId, continuationToken, message: trimmed, history, attachments: normalizedAttachments, files: uploadFiles, workspaceContext }),
          })
        : await fetcher(`${baseEndpoint}/runs`, {
            method: "POST",
            headers: await createAuthHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({
              threadId,
              continuationToken,
              message: trimmed,
              channel: "text",
              history: normalizeHistory(history),
              attachments: normalizedAttachments,
              workspaceContext: normalizeWorkspaceContext(workspaceContext),
            }),
          });

      if (!response.ok) {
        const failure = await readAgentFailureResponse(response);
        throw new AgentServiceError("request_failed", failure?.message ?? `Dwella agent request failed with status ${response.status}.`, {
          status: response.status,
          payload: failure?.payload,
        });
      }

      const payload = await response.json();
      storeContinuationToken(threadId, payload);
      return payload;
    } catch (error) {
      if (error instanceof AgentServiceError) throw error;
      throw new AgentServiceError("network_error", "Dwella agent request failed before a backend response was received.", { cause: error });
    }
  }

  async function createVoiceSession({ threadId }) {
    try {
      const response = await fetcher(`${baseEndpoint}/voice-session`, {
        method: "POST",
        headers: await createAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ threadId }),
      });

      if (!response.ok) {
        const failure = await readAgentFailureResponse(response);
        throw new AgentServiceError("voice_session_failed", failure?.message ?? `Dwella voice session failed with status ${response.status}.`, {
          status: response.status,
          payload: failure?.payload,
        });
      }

      return response.json();
    } catch (error) {
      if (error instanceof AgentServiceError) throw error;
      throw new AgentServiceError("voice_network_error", "Dwella voice session failed before a backend response was received.", { cause: error });
    }
  }

  async function transcribeVoice({ threadId, audioBlob }) {
    if (!(audioBlob instanceof Blob) || audioBlob.size === 0) {
      return { status: "empty" };
    }

    try {
      const form = new FormData();
      form.append("threadId", threadId);
      form.append("audio", audioBlob, "dwella-voice-note.webm");
      const response = await fetcher(`${baseEndpoint}/voice-transcribe`, {
        method: "POST",
        headers: await createAuthHeaders(),
        body: form,
      });

      if (!response.ok) {
        const failure = await readAgentFailureResponse(response);
        throw new AgentServiceError("voice_transcription_failed", failure?.message ?? `Dwella voice transcription failed with status ${response.status}.`, {
          status: response.status,
          payload: failure?.payload,
        });
      }

      return response.json();
    } catch (error) {
      if (error instanceof AgentServiceError) throw error;
      throw new AgentServiceError("voice_transcription_network_error", "Dwella voice transcription failed before a backend response was received.", { cause: error });
    }
  }

  return { getOrCreateThread, sendTextMessage, createVoiceSession, transcribeVoice };

  function getContinuationToken(threadId) {
    const token = storage.getItem(continuationKey(threadId));
    return typeof token === "string" && token.trim() ? token.trim() : undefined;
  }

  function storeContinuationToken(threadId, payload) {
    if (payload?.status !== "waiting") {
      clearContinuationToken(threadId);
      return;
    }
    const token = typeof payload?.continuationToken === "string" ? payload.continuationToken.trim() : "";
    if (token) storage.setItem(continuationKey(threadId), token);
  }

  function clearContinuationToken(threadId) {
    const key = continuationKey(threadId);
    if (typeof storage.removeItem === "function") {
      storage.removeItem(key);
      return;
    }
    storage.setItem(key, "");
  }

  async function createAuthHeaders(baseHeaders = {}) {
    const token = await resolveAuthToken();
    return token ? { ...baseHeaders, Authorization: `Bearer ${token}` } : baseHeaders;
  }

  async function resolveAuthToken() {
    if (typeof getAuthToken !== "function") return null;
    try {
      const token = await getAuthToken();
      const cleanToken = String(token ?? "").trim();
      return cleanToken || null;
    } catch {
      return null;
    }
  }
}

async function readAgentFailureResponse(response) {
  try {
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) return null;
    const payload = await response.json();
    if (!payload || typeof payload !== "object") return null;
    return {
      message: String(payload.error ?? payload.message ?? payload.assistantMessage ?? "").trim(),
      payload,
    };
  } catch {
    return null;
  }
}

function createRunFormData({ threadId, continuationToken, message, history, attachments, files, workspaceContext }) {
  const form = new FormData();
  form.append("threadId", threadId);
  if (continuationToken) form.append("continuationToken", continuationToken);
  form.append("message", message);
  form.append("channel", "text");
  form.append("history", JSON.stringify(normalizeHistory(history)));
  form.append("attachments", JSON.stringify(attachments.map(stripAttachmentFile)));
  form.append("workspaceContext", JSON.stringify(normalizeWorkspaceContext(workspaceContext) ?? {}));
  for (const attachment of files) {
    form.append("files", attachment.file, attachment.name);
  }
  return form;
}

function normalizeAttachments(attachments = []) {
  if (!Array.isArray(attachments)) return [];
  return attachments
    .map((attachment) => ({
      file: attachment?.file,
      name: String(attachment?.name ?? attachment?.file?.name ?? "").trim().slice(0, 180),
      size: Number.isFinite(attachment?.size) ? attachment.size : Number(attachment?.file?.size) || 0,
      type: String(attachment?.type ?? attachment?.file?.type ?? "").trim().slice(0, 120),
    }))
    .filter((attachment) => attachment.name)
    .slice(0, 8);
}

function stripAttachmentFile(attachment) {
  return {
    name: attachment.name,
    size: attachment.size,
    type: attachment.type,
  };
}

function normalizeHistory(history = []) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((message) => message?.role === "user" || message?.role === "assistant")
    .map((message) => ({
      role: message.role,
      content: String(message.content ?? "").trim().slice(0, 800),
    }))
    .filter((message) => message.content)
    .slice(-8);
}

function normalizeWorkspaceContext(context) {
  if (!context || typeof context !== "object") return null;
  return {
    activeArtifact: String(context.activeArtifact ?? "").slice(0, 40),
    activeDocumentTitle: String(context.activeDocumentTitle ?? "").slice(0, 180),
    activeDocumentExcerpt: String(context.activeDocumentExcerpt ?? "").slice(0, 1200),
    documentTitles: Array.isArray(context.documentTitles)
      ? context.documentTitles.map((title) => String(title ?? "").slice(0, 180)).filter(Boolean).slice(0, 8)
      : [],
    fileNames: Array.isArray(context.fileNames)
      ? context.fileNames.map((name) => String(name ?? "").slice(0, 180)).filter(Boolean).slice(0, 12)
      : [],
    browserUrl: String(context.browserUrl ?? "").slice(0, 500),
    mapSummary: String(context.mapSummary ?? "").slice(0, 500),
  };
}

function defaultStorage() {
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

export class AgentServiceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "AgentServiceError";
    this.code = code;
    this.status = details.status ?? null;
    this.payload = details.payload ?? null;
    this.cause = details.cause;
  }
}
