import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import { loadLocalEnv } from "./load-local-env.mjs";

const HOST = "127.0.0.1";
const START_PORT = 3210;
const REQUEST_TIMEOUT_MS = 180_000;
const SERVER_START_TIMEOUT_MS = 120_000;

await loadLocalEnv();

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is required for the live Eve agent verification.");
}

const port = await findOpenPort(START_PORT);
const baseUrl = `http://${HOST}:${port}`;
const server = spawn("npx", ["eve", "start", "--host", HOST, "--port", String(port)], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    HOST,
    PORT: String(port),
    NITRO_HOST: HOST,
    NITRO_PORT: String(port),
  },
  stdio: ["ignore", "pipe", "pipe"],
});

const output = [];
let listeningResolved = false;
let resolveListening;
let rejectListening;
const listeningPromise = new Promise((resolve, reject) => {
  resolveListening = resolve;
  rejectListening = reject;
});
const listeningTimer = setTimeout(() => {
  if (!listeningResolved) rejectListening(new Error(`Eve server did not print a listening URL within ${SERVER_START_TIMEOUT_MS}ms.`));
}, SERVER_START_TIMEOUT_MS);

server.stdout.on("data", recordServerOutput);
server.stderr.on("data", recordServerOutput);
server.once("exit", (code, signal) => {
  if (!listeningResolved) {
    rejectListening(new Error(`Eve server exited before listening (code ${code ?? "null"}, signal ${signal ?? "null"}).`));
  }
});

try {
  await waitForPort(port, SERVER_START_TIMEOUT_MS);
  await listeningPromise;
  await delay(1000);
  await waitForEveHealth(baseUrl, SERVER_START_TIMEOUT_MS);

  const threadId = `verify-agent-full-${Date.now()}`;
  const communication = await postJson(`${baseUrl}/runs`, {
    threadId,
    message: 'Reply exactly with "Dwella smoke communication ready." and do not call tools.',
  });
  assertCompletedRun("communication", communication);
  assert.match(String(communication.assistantMessage ?? ""), /Dwella smoke communication ready/i);
  logStep("communication", communication);

  const mapRun = await postJson(`${baseUrl}/runs`, {
    threadId,
    message: "Add a map marker labelled Paddington Site at lat -27.4592 and lng 152.9958, then say done.",
  });
  assertCompletedRun("map", mapRun);
  logStep("map", mapRun);
  assertHasCommand(mapRun, "add_map_marker");

  const fileRun = await postMultipart(`${baseUrl}/runs`, {
    threadId,
    message: "Use process_uploaded_files to read the attached file in the Eve sandbox, then create a short document titled File Processing Smoke Brief summarizing the site suburb, budget, and tree constraint.",
    filename: "site-notes.txt",
    content: "Site suburb: Paddington QLD.\nBudget: AUD 850k.\nConstraint: retain the jacaranda tree.",
  });
  assertCompletedRun("file processing", fileRun);
  logStep("file processing", fileRun);
  assertHasCommand(fileRun, "create_file");
  const fileDocument = assertHasCommand(fileRun, "create_document");
  assert.match(String(fileDocument.payload?.content ?? ""), /Paddington/i);
  assert.match(String(fileDocument.payload?.content ?? ""), /850(?:k|,000)/i);

  const manipulationRun = await postMultipart(`${baseUrl}/runs`, {
    threadId,
    message: "Call process_uploaded_files with operation redact_copy and redactTerms Jacaranda. Then create a document titled Redaction Smoke Brief confirming the copied output redacts that site name.",
    filename: "sensitive-site-note.txt",
    content: "Secret Site Name: Jacaranda.\nInstruction: retain this privately but redact public copies.",
  });
  assertCompletedRun("file manipulation", manipulationRun);
  logStep("file manipulation", manipulationRun);
  const redactedFile = assertHasCommand(manipulationRun, "create_file");
  assert.match(String(redactedFile.payload?.name ?? ""), /manifest|redacted|sensitive-site-note/i);
  const redactionDocument = assertHasCommand(manipulationRun, "create_document");
  assert.match(String(redactionDocument.payload?.content ?? ""), /redact/i);

  const exportRun = await postJson(`${baseUrl}/runs`, {
    threadId,
    message: "Create a builder brief titled Export Smoke Brief with content: Project rear extension in Paddington. Budget AUD 850k. Requirement export handoff check. Then export the same brief as a PDF.",
  });
  assertCompletedRun("brief export", exportRun);
  logStep("brief export", exportRun);
  assertHasCommand(exportRun, "create_document");
  const exportCommand = assertHasCommand(exportRun, "export_document");
  assert.equal(exportCommand.target, "files");
  assert.equal(exportCommand.payload?.format, "pdf");

  const voiceSession = await postJson(`${baseUrl}/voice-session`, {});
  assert.equal(voiceSession.status, "ready");
  assert.ok(voiceSession.clientSecret, "voice session should include a client secret");
  assert.equal(voiceSession.model, "gpt-realtime-2");
  console.log("voice session: ready");

  console.log(`Live Eve agent verification passed at ${baseUrl}.`);
} catch (error) {
  const tail = output.join("").split("\n").slice(-40).join("\n");
  if (tail.trim()) {
    console.error("Recent Eve output:");
    console.error(tail);
  }
  throw error;
} finally {
  clearTimeout(listeningTimer);
  await stopServer(server);
}

function recordServerOutput(chunk) {
  const text = redactSecrets(chunk.toString());
  output.push(text);
  if (!listeningResolved && /Listening on:/i.test(text)) {
    listeningResolved = true;
    clearTimeout(listeningTimer);
    resolveListening();
  }
}

function assertCompletedRun(label, response) {
  assert.equal(response.status, "completed", `${label} run should complete`);
  assert.ok(response.assistantMessage, `${label} run should return an assistant message`);
}

function assertHasCommand(response, commandType) {
  const command = response.screenCommands?.find((item) => item?.type === commandType);
  assert.ok(command, `expected ${commandType} screen command, got ${summarizeRun(response)}`);
  return command;
}

function summarizeRun(response) {
  const commands = Array.isArray(response.screenCommands)
    ? response.screenCommands.map((command) => `${command?.type ?? "unknown"}:${command?.target ?? "none"}`).join(", ")
    : "none";
  return JSON.stringify({
    status: response.status,
    sessionId: response.sessionId,
    continuationToken: response.continuationToken,
    assistantMessage: String(response.assistantMessage ?? "").slice(0, 280),
    commands,
  });
}

function logStep(label, response) {
  const commands = Array.isArray(response.screenCommands)
    ? response.screenCommands.map((command) => command?.type ?? "unknown").join(",")
    : "none";
  console.log(`${label}: ${response.status} ${response.sessionId ?? "no-session"} ${commands}`);
}

async function postJson(url, body) {
  return await fetchJsonWithRetry(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function postMultipart(url, { threadId, message, filename, content }) {
  const form = new FormData();
  form.set("threadId", threadId);
  form.set("message", message);
  form.append("files", new Blob([content], { type: "text/plain" }), filename);
  form.set("attachments", JSON.stringify([{ name: filename, type: "text/plain", size: content.length }]));
  return await fetchJsonWithRetry(url, { method: "POST", body: form });
}

async function fetchJsonWithRetry(url, options) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < SERVER_START_TIMEOUT_MS) {
    try {
      return await fetchJson(url, options);
    } catch (error) {
      lastError = error;
      if (!isRunnerWarmupError(error)) throw error;
      await delay(1500);
    }
  }

  throw lastError;
}

async function fetchJson(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(`Request failed ${response.status}: ${JSON.stringify(redactObject(data))}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function findOpenPort(startPort) {
  for (let port = startPort; port < startPort + 80; port += 1) {
    if (await isPortOpen(port)) return port;
  }
  throw new Error(`No open port found from ${startPort}.`);
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, HOST);
  });
}

function waitForPort(port, timeoutMs) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const socket = net.createConnection({ host: HOST, port });
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Eve server did not open port ${port} within ${timeoutMs}ms.`));
          return;
        }
        setTimeout(check, 500);
      });
    };
    check();
  });
}

async function waitForEveHealth(baseUrl, timeoutMs) {
  const startedAt = Date.now();
  let lastStatus = "no response";
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/eve/v1/health`);
      lastStatus = String(response.status);
      if (response.ok) {
        const health = await response.json().catch(() => ({}));
        if (health?.ok === true || health?.status === "ready") return;
      }
    } catch (error) {
      lastStatus = error instanceof Error ? error.message : String(error);
    }
    await delay(1000);
  }
  throw new Error(`Eve server did not become healthy within ${timeoutMs}ms at ${baseUrl}/eve/v1/health (last status: ${lastStatus}).`);
}

function stopServer(server) {
  return new Promise((resolve) => {
    if (server.exitCode !== null || server.signalCode) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      server.kill("SIGKILL");
      resolve();
    }, 3000);
    server.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    server.kill("SIGTERM");
  });
}

function redactSecrets(value) {
  return String(value).replace(/sk-[A-Za-z0-9_-]+/g, "sk-REDACTED");
}

function redactObject(value) {
  if (!value || typeof value !== "object") return value;
  return JSON.parse(redactSecrets(JSON.stringify(value)));
}

function isRunnerWarmupError(error) {
  return error?.status === 404
    || (error?.status === 500 && /Runner did not become ready in time/i.test(JSON.stringify(error.data ?? {})));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
