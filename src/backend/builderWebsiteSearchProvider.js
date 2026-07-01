import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { finished } from "node:stream/promises";
import path from "node:path";
import { DEFAULT_BUILDER_DATA_DIR, assertNewBuilderArtifactPath, assertSafeBuilderArtifactFilename } from "./builderArtifacts.js";
import { BackendError } from "./errors.js";
import { normalizeState } from "./utils.js";

const BRAVE_WEB_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search";
const BRAVE_PROVIDER = "brave_web_search";

export function createBraveWebSearchClient(options = {}) {
  const apiKey = String(options.apiKey ?? "").trim();
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const baseUrl = options.baseUrl ?? BRAVE_WEB_SEARCH_URL;

  async function search(query, searchOptions = {}) {
    assertBraveConfigured({ apiKey, fetchImpl });
    const cleanQuery = String(query ?? "").trim();
    if (!cleanQuery) throw new BackendError("validation.required", "query is required for Brave web search");
    const url = new URL(baseUrl);
    url.searchParams.set("q", cleanQuery);
    url.searchParams.set("country", searchOptions.country ?? "AU");
    url.searchParams.set("search_lang", searchOptions.searchLang ?? "en");
    url.searchParams.set("ui_lang", searchOptions.uiLang ?? "en-US");
    url.searchParams.set("count", String(clampCount(searchOptions.count)));
    const response = await fetchImpl(url, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
    });
    if (!response.ok) {
      throw new BackendError("integration.search_provider_failed", `Brave web search failed with HTTP ${response.status}`);
    }
    return normalizeBraveWebSearchResponse(await response.json());
  }

  return {
    provider: BRAVE_PROVIDER,
    search,
  };
}

export function buildWebsiteSearchProviderPlan(request) {
  if (request?.requestStatus !== "pending_search_provider") {
    return {
      eligible: false,
      reason: "Website search request is not pending_search_provider.",
    };
  }
  const query = String(request.query ?? "").trim();
  if (!query) {
    return {
      eligible: false,
      reason: "Website search request has no query.",
    };
  }
  return {
    eligible: true,
    requestId: request.requestId,
    discoveryJobId: request.discoveryJobId,
    builderId: request.builderId,
    builderName: request.builderName,
    states: request.states ?? [],
    query,
    maxResults: clampCount(request.maxResults ?? 10),
    excludedHosts: request.excludedHosts ?? [],
    constraints: [
      "Execute this request with a production search provider only.",
      "Write provider-returned URLs, titles, snippets and ranks exactly as evidence.",
      "Do not infer, synthesize or auto-apply builder website URLs from this request.",
    ],
  };
}

export async function runWebsiteSearchProviderRequest(request, options = {}) {
  const plan = buildWebsiteSearchProviderPlan(request);
  if (!plan.eligible) {
    return {
      schemaVersion: 1,
      status: "skipped",
      requestId: request?.requestId ?? null,
      discoveryJobId: request?.discoveryJobId ?? null,
      builderId: request?.builderId ?? null,
      reason: plan.reason,
    };
  }
  const client = options.client ?? createBraveWebSearchClient({
    apiKey: options.apiKey,
    fetchImpl: options.fetchImpl,
    baseUrl: options.baseUrl,
  });
  const searchedAt = options.searchedAt ?? new Date().toISOString();
  const response = await client.search(plan.query, {
    count: Math.min(plan.maxResults, options.maxResults ?? plan.maxResults),
    country: options.country,
    searchLang: options.searchLang,
    uiLang: options.uiLang,
  });

  return {
    schemaVersion: 1,
    status: "searched",
    searchedAt,
    provider: client.provider ?? BRAVE_PROVIDER,
    sourceUrl: BRAVE_WEB_SEARCH_URL,
    requestId: plan.requestId,
    discoveryJobId: plan.discoveryJobId,
    builderId: plan.builderId,
    builderName: plan.builderName,
    states: plan.states,
    query: plan.query,
    resultCount: response.results.length,
    results: response.results.map((result, index) => ({
      url: result.url,
      title: result.title,
      snippet: result.snippet,
      rank: index + 1,
    })),
    constraints: plan.constraints,
  };
}

export async function writeWebsiteSearchProviderResults(options = {}) {
  const dataDir = options.dataDir ?? DEFAULT_BUILDER_DATA_DIR;
  const outputDir = options.outputDir ?? dataDir;
  const inputFilename = assertSafeBuilderArtifactFilename(
    options.inputFilename ?? "builder-website-search-requests.ndjson",
    "website search input filename"
  );
  const outputFilename = assertSafeBuilderArtifactFilename(options.outputFilename ?? "builder-website-search-results.ndjson", "website search output filename");
  const summaryFilename = assertSafeBuilderArtifactFilename(
    options.summaryFilename ?? "builder-website-search-results-summary.json",
    "website search summary filename"
  );
  const searchedAt = options.searchedAt ?? new Date().toISOString();
  const state = normalizeState(options.state);
  const requestedLimit = Number(options.limit ?? 10);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.floor(requestedLimit)) : 10;
  const inputPath = path.join(dataDir, inputFilename);
  const outputPath = path.join(outputDir, outputFilename);
  const summaryPath = path.join(outputDir, summaryFilename);
  const client = options.client ?? createBraveWebSearchClient({
    apiKey: options.apiKey,
    fetchImpl: options.fetchImpl,
    baseUrl: options.baseUrl,
  });
  const hash = createHash("sha256");
  const byState = {};
  let scannedRequests = 0;
  let eligibleRequests = 0;
  let searchedRequests = 0;
  let resultRows = 0;

  await mkdir(outputDir, { recursive: true });
  await assertNewBuilderArtifactPath(outputPath, outputFilename, { overwrite: options.overwrite });
  await assertNewBuilderArtifactPath(summaryPath, summaryFilename, { overwrite: options.overwrite });
  const output = createWriteStream(outputPath, { encoding: "utf8" });

  try {
    for await (const request of readNdjson(inputPath)) {
      scannedRequests += 1;
      if (state && !request.states?.includes(state)) continue;
      const plan = buildWebsiteSearchProviderPlan(request);
      if (!plan.eligible) continue;
      eligibleRequests += 1;
      if (searchedRequests >= limit) break;
      const result = await runWebsiteSearchProviderRequest(request, {
        client,
        searchedAt,
        maxResults: options.maxResults,
        country: options.country,
        searchLang: options.searchLang,
        uiLang: options.uiLang,
      });
      searchedRequests += 1;
      resultRows += result.results?.length ?? 0;
      for (const itemState of result.states ?? []) byState[itemState] = (byState[itemState] ?? 0) + 1;
      const line = `${JSON.stringify(result)}\n`;
      hash.update(line);
      if (!output.write(line)) {
        await new Promise((resolve) => output.once("drain", resolve));
      }
    }
  } finally {
    output.end();
    await finished(output);
  }

  const summary = {
    schemaVersion: 1,
    searchedAt,
    provider: client.provider ?? BRAVE_PROVIDER,
    inputFile: inputFilename,
    outputFile: outputFilename,
    filters: {
      state: state ?? null,
      limit,
    },
    totals: {
      scannedRequests,
      eligibleRequests,
      searchedRequests,
      resultRows,
    },
    byState,
    files: {
      [outputFilename]: {
        format: "ndjson",
        rowCount: searchedRequests,
        sha256: hash.digest("hex"),
      },
    },
    limitations: [
      "Search-provider results are raw website discovery evidence only.",
      "Generated rows must be scored by the website candidate pipeline before review.",
      "No builder record is updated by this search-provider run.",
    ],
  };
  await writeJsonFile(summaryPath, summary);
  return { outputPath, summaryPath, summary };
}

export function normalizeBraveWebSearchResponse(payload) {
  const results = Array.isArray(payload?.web?.results) ? payload.web.results : [];
  return {
    results: results
      .map((result) => ({
        url: cleanUrl(result.url),
        title: cleanText(result.title),
        snippet: cleanText(result.description ?? result.snippet),
      }))
      .filter((result) => result.url),
  };
}

function assertBraveConfigured({ apiKey, fetchImpl }) {
  if (!fetchImpl) throw new BackendError("integration.search_provider_missing", "Fetch is required for Brave web search");
  if (!apiKey) throw new BackendError("integration.search_provider_missing", "BRAVE_SEARCH_API_KEY is required for live website search provider runs");
}

function clampCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 10;
  return Math.max(1, Math.min(Math.floor(number), 20));
}

function cleanUrl(value) {
  const text = String(value ?? "").trim();
  if (!text) return undefined;
  try {
    return new URL(text).href;
  } catch {
    return undefined;
  }
}

function cleanText(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || null;
}

async function* readNdjson(filepath) {
  const rl = createInterface({ input: createReadStream(filepath) });
  for await (const line of rl) {
    if (line.trim()) yield JSON.parse(line);
  }
}

async function writeJsonFile(filepath, value) {
  const output = createWriteStream(filepath, { encoding: "utf8" });
  output.end(`${JSON.stringify(value, null, 2)}\n`);
  await finished(output);
}
