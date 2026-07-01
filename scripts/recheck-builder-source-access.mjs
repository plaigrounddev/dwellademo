#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import {
  DEFAULT_BUILDER_DATA_DIR,
  readBuilderConvexImportMetadata,
  recheckPendingBuilderSourceAccess,
  toConvexSourceAccessRecheck,
} from "../src/backend/index.js";
import { loadLocalEnv } from "./load-local-env.mjs";

await loadLocalEnv();
const options = parseArgs(process.argv.slice(2));
const report = await recheckPendingBuilderSourceAccess({
  checkedAt: options.checkedAt,
  timeoutMs: options.timeoutMs,
});

if (options.write) {
  await mkdir(options.dataDir, { recursive: true });
  await writeFile(path.join(options.dataDir, "source-access-recheck.json"), `${JSON.stringify(report, null, 2)}\n`);
}

if (options.pushConvex) {
  const convexUrl = options.convexUrl ?? process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL;
  if (!convexUrl) throw new Error("Missing Convex URL. Set CONVEX_URL or VITE_CONVEX_URL, or pass --convex-url.");
  const metadata = await readBuilderConvexImportMetadata(options.dataDir);
  const client = new ConvexHttpClient(convexUrl);
  await client.mutation(api.builderMemory.upsertSourceAccessRecheck, toConvexSourceAccessRecheck(report, metadata.importId));
}

console.log(JSON.stringify(report, null, 2));

function parseArgs(args) {
  const parsed = {
    dataDir: DEFAULT_BUILDER_DATA_DIR,
    checkedAt: new Date().toISOString().slice(0, 10),
    timeoutMs: 15000,
    pushConvex: false,
    write: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--data-dir") {
      parsed.dataDir = args[++index];
    } else if (arg === "--checked-at") {
      parsed.checkedAt = args[++index];
    } else if (arg === "--timeout-ms") {
      parsed.timeoutMs = Number(args[++index]);
      if (!Number.isFinite(parsed.timeoutMs) || parsed.timeoutMs < 1000 || parsed.timeoutMs > 60000) {
        usage("--timeout-ms must be between 1000 and 60000");
      }
    } else if (arg === "--write") {
      parsed.write = true;
    } else if (arg === "--push-convex") {
      parsed.pushConvex = true;
    } else if (arg === "--convex-url") {
      parsed.convexUrl = args[++index];
    } else if (arg === "--help" || arg === "-h") {
      usage();
    } else {
      usage(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function usage(error) {
  if (error) console.error(error);
  console.error(`Usage:
  node scripts/recheck-builder-source-access.mjs [--write] [--push-convex] [--data-dir data/builders] [--checked-at YYYY-MM-DD] [--timeout-ms 15000]`);
  process.exit(error ? 1 : 0);
}
