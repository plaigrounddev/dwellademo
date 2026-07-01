import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const read = (file) => readFile(path.join(root, file), "utf8");

const [
  app,
  packageJson,
  schema,
  convexConfig,
  durableAgentApi,
  durableAgent,
  durableTools,
  http,
  workspace,
  viteConfig,
  vercelConfig,
  realtimeWrapper,
  documentExport,
  client,
] = await Promise.all([
  read("src/App.jsx"),
  read("package.json"),
  read("convex/schema.js"),
  read("convex/convex.config.ts"),
  read("convex/dwellaAgentApi.js"),
  read("convex/dwellaAgent.js"),
  read("convex/dwellaAgentTools.js"),
  read("convex/http.js"),
  read("convex/agentWorkspace.js"),
  read("vite.config.js"),
  read("vercel.json"),
  read("convex/openaiRealtime.js"),
  read("src/agent/documentExport.js"),
  read("src/agent/client.js"),
]);

assert.match(packageJson, /"convex-durable-agents"/, "Package must install the Convex Durable Agents component");
assert.match(packageJson, /"ai": "\^6\./, "Durable Agents requires AI SDK v6");
assert.doesNotMatch(packageJson, /"eve"/, "Package should not depend on Eve");
assert.doesNotMatch(packageJson, /eve:/, "Package scripts should not expose Eve commands");

assert.match(convexConfig, /convex-durable-agents\/convex\.config\.js/, "Convex component config missing durable agents");
assert.match(convexConfig, /app\.use\(durableAgents\)/, "Convex app must register the durable agents component");
assert.match(convexConfig, /OPENAI_API_KEY/, "Convex config must declare OpenAI env");

assert.match(schema, /dwellaDurableThreads: defineTable/, "Schema must map browser threads to durable agent threads");
assert.match(schema, /by_ownerTokenIdentifier_and_clientThreadId/, "Durable thread mapping must be owner scoped");
assert.match(schema, /agentThreadId: v\.string\(\)/, "Durable thread mapping must store the component thread id");
assert.match(schema, /agentDocuments: defineTable/, "Workspace documents should remain Convex durable");
assert.match(schema, /agentFiles: defineTable/, "Workspace files should remain Convex durable");
assert.match(schema, /agentMapMarkers: defineTable/, "Workspace map markers should remain Convex durable");

assert.match(durableAgentApi, /streamHandlerAction\(components\.durable_agents/, "Durable agent handler must use the Convex component");
assert.match(durableAgentApi, /defineInternalAgentApi\(components\.durable_agents/, "Agent API should be internal behind the HTTP bridge");
assert.match(durableAgentApi, /createOpenAI/, "Durable agent must use the OpenAI AI SDK provider");
assert.match(durableAgentApi, /saveStreamDeltas: true/, "Durable streaming deltas should be persisted");
assert.match(durableAgentApi, /retry:\s*\{[\s\S]*enabled: true/, "Durable agent should retry failed model turns");
for (const tool of [
  "show_artifact",
  "append_to_document",
  "replace_document",
  "create_document",
  "export_document",
  "create_file",
  "create_folder",
  "set_browser_url",
  "add_map_marker",
  "request_builder_outreach_approval",
]) {
  assert.match(durableAgentApi, new RegExp(`${tool}: createActionTool`), `Durable agent missing tool: ${tool}`);
}

assert.match(durableAgent, /ensureDurableThread = internalMutation/, "Durable thread wrapper missing");
assert.match(durableAgent, /ctx\.runMutation\(internal\.dwellaAgentApi\.createThread/, "Wrapper must create component threads");
assert.match(durableAgent, /ownerTokenIdentifier/, "Durable thread wrapper must key ownership from Convex auth");

for (const handler of [
  "showArtifact",
  "appendToDocument",
  "replaceDocument",
  "createDocument",
  "exportDocument",
  "createFile",
  "createFolder",
  "setBrowserUrl",
  "addMapMarker",
  "requestBuilderOutreachApproval",
]) {
  assert.match(durableTools, new RegExp(`export const ${handler} = internalAction`), `Tool action missing: ${handler}`);
}
assert.match(durableTools, /screenCommands/, "Tool actions must return screen commands");
assert.match(durableTools, /approval_required/, "Builder outreach must remain approval gated");

assert.match(http, /route\("POST", "\/dwella\/agent\/runs"/, "Convex HTTP route for text runs missing");
assert.match(http, /internal\.dwellaAgent\.ensureDurableThread/, "HTTP route must bridge browser threads to durable threads");
assert.match(http, /internal\.dwellaAgentApi\.sendMessage/, "HTTP route must enqueue durable agent messages");
assert.match(http, /internal\.dwellaAgentApi\.listMessages/, "HTTP route must read durable agent messages");
assert.match(http, /waitForAgentTurn/, "HTTP route must wait for the durable turn boundary");
assert.match(http, /voice-session/, "Voice session route missing");
assert.match(http, /voice-transcribe/, "Voice transcription route missing");
assert.match(http, /OPENAI_REALTIME_MODEL/, "Voice route must use the Realtime model constant");
assert.doesNotMatch(http, /Eve/i, "Convex HTTP bridge should not reference Eve");

assert.match(app, /VITE_DWELLA_AGENT_ENDPOINT \|\| "\/dwella\/agent"/, "App must keep configurable agent endpoint");
assert.match(app, /getToken\(\{ template: "convex" \}\)/, "Client must send Clerk Convex auth to the agent bridge");
assert.match(app, /data-component="convex-document-editor"/, "Document editor marker missing");
assert.match(app, /actions\.updateDocument|appendDocumentText|replaceDocumentText/, "Document update action missing");
assert.match(app, /RTCPeerConnection/, "Realtime voice connection should remain available");

assert.match(client, /\/runs/, "Agent client must still call the text run route");
assert.match(client, /\/voice-session/, "Agent client must still call the voice session route");
assert.match(client, /\/voice-transcribe/, "Agent client must still call the transcription route");
assert.match(client, /Authorization: `Bearer \$\{token\}`/, "Agent client must attach Clerk auth");

assert.match(viteConfig, /VITE_CONVEX_SITE_URL/, "Local Vite proxy must point at Convex site");
assert.match(viteConfig, /deriveConvexSiteUrl/, "Vite should derive Convex site URL from VITE_CONVEX_URL when needed");
assert.doesNotMatch(viteConfig, /VITE_DWELLA_EVE_URL|DWELLA_EVE_URL/, "Local Vite should not proxy to Eve");

assert.match(vercelConfig, /convex\.site/, "Vercel rewrite should route agent traffic to Convex site");
assert.doesNotMatch(vercelConfig, /experimentalServices|_eve_internal|framework": "eve"/, "Vercel config should not deploy Eve");

assert.match(realtimeWrapper, /realtime\/client_secrets/, "Realtime client secret endpoint missing");
assert.match(realtimeWrapper, /OPENAI_REALTIME_MODEL = "gpt-realtime-2"/, "Realtime 2 model missing from Convex wrapper");
assert.match(documentExport, /PDFDocument/, "Document export helper must generate real PDF bytes");
assert.match(documentExport, /application\/msword/, "Document export helper must support DOC handoff");

assert.match(workspace, /export const createDocument = mutation/, "Convex createDocument mutation missing");
assert.match(workspace, /export const updateDocument = mutation/, "Convex updateDocument mutation missing");
assert.match(workspace, /export const createFile = mutation/, "Convex createFile mutation missing");
assert.match(workspace, /export const addMapMarker = mutation/, "Convex addMapMarker mutation missing");

console.log("Convex durable agent workspace verification passed.");
