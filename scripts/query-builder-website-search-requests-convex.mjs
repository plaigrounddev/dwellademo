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
const result = await client.query(api.builderMemory.searchWebsiteSearchRequests, {
  state: options.state,
  requestStatus: options.requestStatus,
  limit: options.limit,
});

printJson({
  status: "ok",
  state: options.state ?? null,
  requestStatus: options.requestStatus ?? "pending_search_provider",
  count: result.count,
  results: result.results,
  limitations: result.limitations,
});

function parseArgs(args) {
  const parsed = {
    limit: 25,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--convex-url") {
      parsed.convexUrl = args[++index];
    } else if (arg === "--state") {
      parsed.state = args[++index];
    } else if (arg === "--request-status") {
      parsed.requestStatus = args[++index];
    } else if (arg === "--limit") {
      parsed.limit = Number(args[++index]);
      if (!Number.isFinite(parsed.limit) || parsed.limit < 1) usage("--limit must be a positive number");
    } else if (arg === "--help" || arg === "-h") {
      usage();
    } else {
      usage(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function usage(error) {
  if (error) console.error(error);
  console.error(`Usage:
  CONVEX_URL=https://... node scripts/query-builder-website-search-requests-convex.mjs [--state QLD] [--request-status pending_search_provider] [--limit 25]`);
  process.exit(error ? 1 : 0);
}
