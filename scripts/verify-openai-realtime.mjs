import { loadLocalEnv } from "./load-local-env.mjs";
import {
  OPENAI_REALTIME_MODEL,
  createOpenAIRealtimeClientSecret,
} from "../agent/lib/openaiRealtime.js";
import { DWELLA_AGENT_INSTRUCTIONS } from "../convex/dwellaConversationContract.js";

await loadLocalEnv();

const result = await createOpenAIRealtimeClientSecret({
  apiKey: process.env.OPENAI_API_KEY,
  instructions: DWELLA_AGENT_INSTRUCTIONS,
  tools: [
    {
      type: "function",
      name: "show_artifact",
      description: "Show one workspace artifact panel.",
      parameters: {
        type: "object",
        properties: {
          target: { type: "string", enum: ["doc", "map", "browser", "files"] },
        },
        required: ["target"],
      },
    },
  ],
  safetyIdentifier: "dwella-terminal-smoke",
});

if (!result.ok) {
  console.error(JSON.stringify({
    ok: false,
    status: result.status,
    error: result.error,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  model: result.model,
  expectedModel: OPENAI_REALTIME_MODEL,
  hasClientSecret: Boolean(result.clientSecret),
  expiresAt: result.expiresAt ?? null,
  sessionId: result.sessionId ?? null,
}, null, 2));
