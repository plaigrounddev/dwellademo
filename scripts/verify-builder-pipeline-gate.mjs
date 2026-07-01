#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";

const options = parseArgs(process.argv.slice(2));
const startedAt = new Date().toISOString();
const commands = [
  ["verify:builders", ["--", "--data-dir", options.dataDir]],
  ["verify:builders:convex", ["--", "--data-dir", options.dataDir]],
  ["verify:builders:coverage-convex", ["--", "--data-dir", options.dataDir]],
  ["verify:builders:source-access-convex", ["--", "--data-dir", options.dataDir]],
  ["check:builders:pipeline", ["--", "--data-dir", options.dataDir]],
  ["verify:builders:enrichment-convex", ["--", "--data-dir", options.dataDir]],
  ["verify:builders:website-discovery-convex", ["--", "--data-dir", options.dataDir]],
  ["verify:builders:detailed-list-convex", ["--", "--data-dir", options.dataDir]],
  ["verify:builders:production-readiness-convex", ["--", "--data-dir", options.dataDir]],
  ["verify:builders:duplicate-review-convex", ["--", "--data-dir", options.dataDir]],
  ["verify:builders:website-search-requests-convex", ["--", "--data-dir", options.dataDir]],
];

const results = [];
for (const [script, args] of commands) {
  const started = Date.now();
  const result = await runNpmScript(script, args, { cwd: options.cwd });
  results.push({
    script,
    status: result.exitCode === 0 ? "ok" : "failed",
    exitCode: result.exitCode,
    elapsedMs: Date.now() - started,
    summary: summarizeJsonOutput(result.stdout),
    stdout: options.includeOutput ? result.stdout : undefined,
    stderr: result.stderr || undefined,
  });
  if (result.exitCode !== 0 && options.failFast) break;
}

const failures = results.filter((result) => result.status !== "ok");
const report = {
  status: failures.length ? "failed" : "ok",
  startedAt,
  completedAt: new Date().toISOString(),
  dataDir: options.dataDir,
  writesBuilderEvidence: false,
  runsExternalEnrichmentProviders: false,
  checks: results,
  failures: failures.map((failure) => ({
    script: failure.script,
    exitCode: failure.exitCode,
    stderr: failure.stderr,
    summary: failure.summary,
  })),
};

console.log(JSON.stringify(report, null, 2));
if (report.status !== "ok") process.exit(1);

function runNpmScript(script, args, { cwd }) {
  return new Promise((resolve) => {
    const child = spawn("npm", ["run", script, ...args], {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (exitCode) => {
      resolve({ exitCode, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

function summarizeJsonOutput(stdout) {
  const start = stdout.lastIndexOf("\n{");
  const candidate = start >= 0 ? stdout.slice(start + 1) : stdout.slice(stdout.indexOf("{"));
  if (!candidate.trim()) return null;
  try {
    const parsed = JSON.parse(candidate);
    return {
      status: parsed.status ?? null,
      builders: parsed.builders ?? parsed.summary?.builders ?? parsed.expectedTotals?.builders ?? null,
      licences: parsed.licences ?? parsed.summary?.licences ?? parsed.expectedTotals?.licences ?? null,
      expectedRows: parsed.expectedRows ?? null,
      loadedRows: parsed.loadedRows ?? null,
      readinessStatus: parsed.readinessStatus ?? parsed.productionReadiness ?? null,
      blockerCount: parsed.blockerCount ?? parsed.blockers?.length ?? null,
      convexSourceAccessStatus: parsed.convex?.sourceAccess?.status ?? null,
      failures: parsed.failures ?? [],
    };
  } catch {
    return null;
  }
}

function parseArgs(args) {
  const parsed = {
    cwd: path.resolve(path.join(import.meta.dirname, "..")),
    dataDir: "data/builders",
    failFast: true,
    includeOutput: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--data-dir") parsed.dataDir = args[++index];
    else if (arg === "--cwd") parsed.cwd = args[++index];
    else if (arg === "--no-fail-fast") parsed.failFast = false;
    else if (arg === "--include-output") parsed.includeOutput = true;
    else if (arg === "--help" || arg === "-h") usage();
    else usage(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function usage(error) {
  if (error) console.error(error);
  console.error(`Usage:
  node scripts/verify-builder-pipeline-gate.mjs [--data-dir data/builders] [--no-fail-fast] [--include-output]

Runs read-only local and Convex builder verification gates. It does not call enrichment providers or write builder evidence.`);
  process.exit(error ? 1 : 0);
}
