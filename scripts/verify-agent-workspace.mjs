import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const read = (file) => readFile(path.join(root, file), "utf8");

const [
  app,
  styles,
  packageJson,
  workspace,
  schema,
  realtimeWrapper,
  viteConfig,
  vercelConfig,
  eveAgent,
  eveInstructions,
  eveChannel,
  eveSandbox,
  eveFileProcessor,
  eveWorkspaceCommands,
  documentExport,
  routeSecurity,
  ...eveToolFiles
] = await Promise.all([
  read("src/App.jsx"),
  read("src/styles.css"),
  read("package.json"),
  read("convex/agentWorkspace.js"),
  read("convex/schema.js"),
  read("agent/lib/openaiRealtime.js"),
  read("vite.config.js"),
  read("vercel.json"),
  read("agent/agent.ts"),
  read("agent/instructions.md"),
  read("agent/channels/dwella.ts"),
  read("agent/sandbox/sandbox.ts"),
  read("agent/sandbox/workspace/bin/dwella_file_processor.py"),
  read("agent/lib/workspaceCommands.ts"),
  read("src/agent/documentExport.js"),
  read("agent/lib/routeSecurity.ts"),
  ...[
    "add_map_marker",
    "append_to_document",
    "create_document",
    "export_document",
    "create_file",
    "create_folder",
    "replace_document",
    "process_uploaded_files",
    "request_builder_outreach_approval",
    "set_browser_url",
    "show_artifact",
  ].map((tool) => read(`agent/tools/${tool}.ts`)),
]);

await assertPathMissing("src/backend");
await assertPathMissing("convex/builderMemory.js");

const workspaceTools = [
  "show_artifact",
  "append_to_document",
  "replace_document",
  "create_document",
  "export_document",
  "create_file",
  "create_folder",
  "set_browser_url",
  "add_map_marker",
];

for (const tool of workspaceTools) {
  assert.match(app, new RegExp(`name === "${tool}"`), `React realtime tool executor missing: ${tool}`);
  assert.match(eveChannel, new RegExp(`name: "${tool}"`), `Eve realtime tool missing: ${tool}`);
}

assert.match(eveAgent, /defineAgent/, "Eve agent config missing");
assert.match(eveAgent, /DWELLA_EVE_MODEL/, "Eve model env override missing");
assert.match(eveAgent, /@ai-sdk\/openai/, "Eve should use the OpenAI provider when AI Gateway is not configured");
assert.match(eveInstructions, /durable homebuilding agent/, "Eve instructions missing Dwella identity");
assert.match(eveInstructions, /Keep durable project and workspace state in Convex/, "Eve instructions must preserve Convex as durable store");
assert.match(eveChannel, /defineChannel/, "Eve Dwella channel missing");
assert.match(eveChannel, /POST\("\/dwella\/agent\/runs"/, "Eve Dwella compatibility route missing");
assert.match(eveChannel, /POST\("\/runs"/, "Eve Dwella endpoint route missing");
assert.match(eveChannel, /POST\("\/voice-session"/, "Eve voice session route missing");
assert.match(eveChannel, /POST\("\/voice-transcribe"/, "Eve voice transcription route missing");
assert.match(eveChannel, /session\.getEventStream/, "Eve channel must translate durable stream events");
assert.match(eveChannel, /screenCommands/, "Eve channel must return Dwella screen commands");
assert.match(eveChannel, /continuationToken,\s*\n\s*state: \{ dwellaThreadId: threadId \}/, "Eve channel must keep app thread ids separate from Eve continuation tokens");
assert.doesNotMatch(eveChannel, /continuationToken: threadId/, "Eve channel must not reuse stable app thread ids as continuation tokens");
assert.match(eveChannel, /authenticateDwellaRequest/, "Eve channel must authenticate inbound route requests");
assert.match(eveChannel, /checkDwellaRateLimit/, "Eve channel must rate-limit authenticated requests");
assert.match(eveChannel, /rejectOversizeRequest/, "Eve channel must reject oversize requests before form parsing");
assert.match(eveChannel, /createScopedContinuationToken/, "Eve continuation tokens must be scoped to the authenticated principal");
assert.match(eveChannel, /cleanScopedContinuationToken/, "Eve channel must ignore mismatched continuation tokens");
assert.doesNotMatch(eveChannel, /auth:\s*null/, "Eve channel must never start production runs with null auth");
assert.match(routeSecurity, /routeAuth/, "Dwella route security must use Eve routeAuth");
assert.match(routeSecurity, /verifyOidc/, "Dwella route security must verify Clerk OIDC tokens");
assert.match(routeSecurity, /DWELLA_EVE_ROUTE_SECRET/, "Dwella route security must support internal proxy secret auth");
assert.match(routeSecurity, /localDev\(\)/, "Dwella route security must preserve local development smoke tests");
assert.match(routeSecurity, /MAX_AGENT_REQUEST_BYTES/, "Dwella route security must define request body limits");
assert.match(routeSecurity, /rateLimitBuckets/, "Dwella route security must include a route rate limiter");
assert.match(eveChannel, /type:\s*"file" as const/, "Eve channel must send uploads as Eve file parts");
assert.match(eveChannel, /data:\s*file\.data/, "Eve file parts must include raw file bytes");
assert.match(eveChannel, /\/workspace\/attachments/, "Eve channel must point the model at sandbox-staged attachments");
assert.doesNotMatch(eveChannel, /MAX_INLINE_FILE_CHARS|readBlobText|isInlineReadableFile/, "Eve channel must not fall back to inline-only file reading");
assert.match(eveChannel, /OPENAI_REALTIME_MODEL/, "Eve voice route must use the shared Realtime 2 model constant");
assert.match(eveChannel, /audio\/transcriptions/, "Eve voice route must support transcription fallback");
assert.match(eveSandbox, /defineSandbox/, "Eve sandbox definition missing");
assert.match(eveSandbox, /defaultBackend/, "Eve sandbox should use Eve's default sandbox backend selection");
assert.match(eveSandbox, /\/workspace\/attachments/, "Eve sandbox must prepare uploaded attachment workspace");
assert.match(eveFileProcessor, /pypdf|PdfReader/, "File processor must support PDF extraction");
assert.match(eveFileProcessor, /from docx import Document/, "File processor must support DOCX extraction");
assert.match(eveFileProcessor, /openpyxl|load_workbook/, "File processor must support XLSX extraction");
assert.match(eveFileProcessor, /Image\.open/, "File processor must support image metadata extraction");
assert.match(eveFileProcessor, /redact_copy/, "File processor must support manipulation/redaction outputs");
assert.match(eveFileProcessor, /originalPreserved/, "File processor must preserve normalized originals for every upload");
assert.match(eveFileProcessor, /uploadedFilesExecuted/, "File processor manifest must state uploaded files are not executed");
assert.match(eveToolFiles.join("\n"), /process_uploaded_files/, "Eve processing tool missing from discovered tool files");
assert.match(eveToolFiles.join("\n"), /ctx\.getSandbox\(\)/, "Eve processing tool must use the live sandbox");
assert.match(eveToolFiles.join("\n"), /cleanupAttachments/, "Eve processing tool must expose raw attachment cleanup");
assert.match(eveToolFiles.join("\n"), /attachmentsCleaned/, "Eve processing tool must report raw attachment cleanup");
assert.match(eveWorkspaceCommands, /DwellaScreenCommand/, "Eve workspace command contract missing");
assert.match(documentExport, /PDFDocument/, "Document export helper must generate real PDF bytes");
assert.match(documentExport, /application\/msword/, "Document export helper must support DOC handoff");
assert.match(app, /createDocumentExport/, "Client must generate document exports from screen commands");
assert.match(app, /downloadDocumentExport/, "Client must download generated document exports");
assert.match(app, /getToken\(\{ template: "convex" \}\)/, "Client must fetch Clerk Convex tokens for the Eve agent");

for (const [index, toolFile] of eveToolFiles.entries()) {
  assert.match(toolFile, /defineTool/, `Eve tool file ${index} missing defineTool`);
}
assert.match(eveToolFiles.join("\n"), /approval: always\(\)/, "Builder outreach tool must require Eve approval");

assert.match(viteConfig, /VITE_DWELLA_EVE_URL/, "Local Vite must proxy Dwella agent routes to Eve");
assert.doesNotMatch(viteConfig, /VITE_CONVEX_SITE_URL/, "Local Vite must not proxy Dwella agent routes to Convex");
assert.match(vercelConfig, /experimentalServices/, "Vercel must deploy the Vite shell and Eve runtime as services");
assert.match(vercelConfig, /"\/_eve_internal\/eve"/, "Vercel must mount Eve behind an internal service prefix");
assert.doesNotMatch(vercelConfig, /api\/dwella|CONVEX_SITE_URL|DWELLA_EVE_AGENT_URL/, "Vercel must not route Dwella agent calls through the old API or Convex proxy");
assert.doesNotMatch(packageJson, /builders?:|src\/backend|builderMemory/, "Package scripts must not expose removed builder/backend pipelines");
assert.deepEqual(await listBuilderScripts(), [], "Builder/import scripts should not remain in the runtime repo");
assert.match(realtimeWrapper, /realtime\/client_secrets/, "Realtime client secret endpoint missing");
assert.match(realtimeWrapper, /OPENAI_REALTIME_MODEL = "gpt-realtime-2"/, "Realtime 2 model missing from wrapper");
for (const commandType of [
  "append_to_document",
  "replace_document",
  "create_document",
  "export_document",
  "create_file",
  "create_folder",
  "set_browser_url",
  "add_map_marker",
]) {
  assert.match(app, new RegExp(`command\\?\\.type === "${commandType}"`), `Client command executor missing: ${commandType}`);
}

assert.match(app, /data-component="convex-document-editor"/, "Document editor marker missing");
assert.match(app, /className="document-title-input"/, "Document title input missing");
assert.match(app, /className="document-body-input"/, "Document body editor missing");
assert.match(app, /workspaceActions\.updateDocument/, "Document update action missing");
assert.match(workspace, /export const createDocument = mutation/, "Convex createDocument mutation missing");
assert.match(workspace, /export const updateDocument = mutation/, "Convex updateDocument mutation missing");
assert.match(schema, /agentDocuments: defineTable/, "Convex agentDocuments schema missing");
assert.doesNotMatch(schema, /builder[A-Z]|builders: defineTable|builderMemory/, "Convex schema should only keep durable agent workspace tables");

assert.match(app, /L\.map/, "Leaflet map initialization missing");
assert.match(app, /tile\.openstreetmap\.org/, "OpenStreetMap tile layer missing");
assert.match(app, /ResizeObserver/, "Map resize handling missing");
assert.match(workspace, /export const updateMapView = mutation/, "Convex map view mutation missing");
assert.match(workspace, /export const addMapMarker = mutation/, "Convex map marker mutation missing");
assert.match(schema, /agentMapMarkers: defineTable/, "Convex map marker schema missing");

assert.match(app, /function FilesArtifact/, "Files artifact component missing");
assert.match(app, /actions\.createFolder/, "Folder creation UI missing");
assert.match(app, /actions\.createFile/, "File creation UI missing");
assert.match(app, /actions\.setActiveDocument/, "Document file open behavior missing");
assert.match(workspace, /export const createFolder = mutation/, "Convex createFolder mutation missing");
assert.match(workspace, /export const createFile = mutation/, "Convex createFile mutation missing");
assert.match(schema, /agentFiles: defineTable/, "Convex agentFiles schema missing");

assert.match(app, /RTCPeerConnection/, "Realtime WebRTC connection missing");
assert.match(app, /createDataChannel\("oai-events"\)/, "Realtime event channel missing");
assert.match(app, /function_call_output/, "Realtime function output handling missing");
assert.match(app, /response\.function_call_arguments\.done/, "Realtime function-call event handling missing");
assert.match(app, /https:\/\/api\.openai\.com\/v1\/realtime\/calls/, "Realtime calls endpoint missing");
assert.match(app, /realtimeDisconnectTimerRef/, "Realtime transient disconnect grace handling missing");
assert.match(app, /peer\.connectionState === "disconnected"[\s\S]*window\.setTimeout/, "Realtime disconnected state should use delayed teardown");
assert.doesNotMatch(app, /\["failed", "closed", "disconnected"\]\.includes\(peer\.connectionState\)/, "Realtime disconnected state should not immediately tear down voice");
assert.doesNotMatch(app, /type:\s*"session\.update"[\s\S]{0,900}model\s*:/, "Browser should not resend server-bound realtime model config");
assert.match(eveChannel, /createOpenAIRealtimeClientSecret/, "Realtime client secret wrapper missing from Eve handler");

assert.match(styles, /\.agent-shell--artifact-closed/, "Closed artifact layout missing");
assert.match(styles, /\.agent-preview/, "Artifact preview styles missing");
assert.match(styles, /\.agent-bottom-sheet-handle/, "Mobile bottom sheet handle missing");
assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.agent-preview[\s\S]*position: fixed/, "Mobile fixed artifact sheet missing");
assert.match(styles, /transform: translateY\(calc\(100% \+ 1\.5rem\)\)/, "Closed mobile artifact slide-out missing");
assert.doesNotMatch(styles, /\.agent-[^{]+{[^}]*font-family:[^}]*mono/is, "Agent shell should not use mono font styling");

console.log("Agent workspace verification passed.");

async function assertPathMissing(filePath) {
  try {
    await stat(path.join(root, filePath));
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  assert.fail(`${filePath} should not exist`);
}

async function listBuilderScripts() {
  const entries = await readdir(path.join(root, "scripts"));
  return entries.filter((entry) => /builder|builders/.test(entry)).sort();
}
