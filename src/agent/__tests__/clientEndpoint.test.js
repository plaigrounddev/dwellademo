import assert from "node:assert/strict";
import test from "node:test";
import { createDwellaAgentClient } from "../client.js";

test("agent client sends text and voice traffic through the same-origin endpoint with Clerk auth", async () => {
  const requests = [];
  const client = createDwellaAgentClient({
    endpoint: "/dwella/agent",
    storage: createFakeStorage(),
    getAuthToken: async () => "clerk-session-token",
    fetcher: async (url, init) => {
      requests.push({ url, init });
      return {
        ok: true,
        json: async () => ({ status: "completed", assistantMessage: "Done." }),
      };
    },
  });
  const thread = client.getOrCreateThread();

  await client.sendTextMessage({
    threadId: thread.id,
    message: "prepare my builder brief",
    history: [{ role: "assistant", content: "What suburb?" }],
  });
  await client.createVoiceSession({ threadId: thread.id });

  assert.equal(requests[0].url, "/dwella/agent/runs");
  assert.equal(requests[0].init.headers.Authorization, "Bearer clerk-session-token");
  assert.equal(JSON.parse(requests[0].init.body).message, "prepare my builder brief");
  assert.equal(requests[1].url, "/dwella/agent/voice-session");
  assert.equal(requests[1].init.headers.Authorization, "Bearer clerk-session-token");
  assert.equal(JSON.parse(requests[1].init.body).threadId, thread.id);
});

test("agent client sends voice transcription through the same-origin endpoint", async (t) => {
  if (typeof Blob === "undefined" || typeof FormData === "undefined") {
    t.skip("Blob and FormData are not available in this runtime");
    return;
  }

  let request = null;
  const client = createDwellaAgentClient({
    endpoint: "/dwella/agent",
    storage: createFakeStorage(),
    getAuthToken: async () => "clerk-session-token",
    fetcher: async (url, init) => {
      request = { url, init };
      return {
        ok: true,
        json: async () => ({ status: "completed", transcript: "build near Brisbane" }),
      };
    },
  });
  const thread = client.getOrCreateThread();
  await client.transcribeVoice({ threadId: thread.id, audioBlob: new Blob(["voice"], { type: "audio/webm" }) });

  assert.equal(request.url, "/dwella/agent/voice-transcribe");
  assert.equal(request.init.headers.Authorization, "Bearer clerk-session-token");
  assert.ok(request.init.body instanceof FormData);
  assert.equal(request.init.body.get("threadId"), thread.id);
  assert.equal(request.init.body.get("audio").name, "dwella-voice-note.webm");
});

function createFakeStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}
