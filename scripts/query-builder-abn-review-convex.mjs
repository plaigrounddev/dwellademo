#!/usr/bin/env node
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { loadLocalEnv } from "./load-local-env.mjs";

await loadLocalEnv();
const options = parseArgs(process.argv.slice(2));
const convexUrl = options.convexUrl ?? process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL;

if (!convexUrl) {
  throw new Error("Missing Convex URL. Set CONVEX_URL or VITE_CONVEX_URL, or pass --convex-url.");
}

const client = new ConvexHttpClient(convexUrl);
let result;

if (options.kind === "lookup") {
  result = await client.query(api.builderMemory.searchAbnLookupResults, {
    status: options.status,
    limit: options.limit,
  });
} else if (options.kind === "proposals") {
  result = await client.query(api.builderMemory.searchAbnMergeProposals, {
    status: options.status,
    limit: options.limit,
  });
} else {
  usage(`Unknown --kind: ${options.kind}`);
}

printJson({
  status: "ok",
  kind: options.kind,
  reviewStatus: options.status ?? null,
  count: result.count,
  results: result.results,
  limitations: result.limitations,
});

function parseArgs(args) {
  const parsed = {
    kind: "lookup",
    limit: 25,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--convex-url") {
      parsed.convexUrl = args[++index];
    } else if (arg === "--kind") {
      parsed.kind = args[++index];
    } else if (arg === "--status") {
      parsed.status = args[++index];
    } else if (arg === "--limit") {
      parsed.limit = Number(args[++index]);
      if (!Number.isFinite(parsed.limit) || parsed.limit < 1) usage("--limit must be a positive number");
    } else if (arg === "--help" || arg === "-h") {
      usage();
    } else {
      usage(`Unknown argument: ${arg}`);
    }
  }

  if (!["lookup", "proposals"].includes(parsed.kind)) usage("--kind must be lookup or proposals");
  return parsed;
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function usage(error) {
  if (error) console.error(error);
  console.error(`Usage:
  CONVEX_URL=https://... node scripts/query-builder-abn-review-convex.mjs --kind lookup [--status checked] [--limit 25]
  CONVEX_URL=https://... node scripts/query-builder-abn-review-convex.mjs --kind proposals [--status proposed] [--limit 25]`);
  process.exit(error ? 1 : 0);
}
