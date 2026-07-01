#!/usr/bin/env node
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  BUILDER_DATA_SOURCES,
  buildBuilderDuplicateReviewQueue,
  buildBuilderMemoryCards,
  buildBuilderSearchIndex,
  buildBuilderSourceAccessReport,
  combineLicenceRows,
  listBuilderDataSources,
  mapActProfessionalRow,
  mapNswContractorRow,
  mapNtBpbRow,
  mapQbccRow,
  mapVicBpcRow,
  mapWaBuilderRow,
  summarizeBuilderDataQuality,
  summarizeBuilderImport,
} from "../src/backend/index.js";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "data", "builders");
const PYTHON = process.env.PYTHON_BIN ?? "/Users/denisestimon/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
const DEFAULT_PAGE_SIZE = 5000;

const options = parseArgs(process.argv.slice(2));
const startedAt = new Date().toISOString();
const fetchedAt = Date.now();
const rows = [];
const sourceStats = [];

await mkdir(OUTPUT_DIR, { recursive: true });

if (options.sources.has("qld")) {
  const result = await fetchQbccRows({ limit: options.limit, pageSize: options.pageSize ?? DEFAULT_PAGE_SIZE, fetchedAt });
  rows.push(...result.rows);
  sourceStats.push(result.stats);
}

if (options.sources.has("nsw")) {
  const result = await fetchNswRows({ limit: options.limit, fetchedAt });
  rows.push(...result.rows);
  sourceStats.push(result.stats);
}

if (options.sources.has("vic")) {
  const result = await fetchVicRows({ limit: options.limit, fetchedAt });
  rows.push(...result.rows);
  sourceStats.push(result.stats);
}

if (options.sources.has("wa")) {
  const result = await fetchWaRows({ limit: options.limit, fetchedAt });
  rows.push(...result.rows);
  sourceStats.push(result.stats);
}

if (options.sources.has("act")) {
  const result = await fetchActRows({ limit: options.limit, fetchedAt });
  rows.push(...result.rows);
  sourceStats.push(result.stats);
}

if (options.sources.has("nt")) {
  const result = await fetchNtRows({ limit: options.limit, fetchedAt });
  rows.push(...result.rows);
  sourceStats.push(result.stats);
}

const combined = combineLicenceRows(rows);
const memoryCards = buildBuilderMemoryCards(combined.builders, combined.builderLicences, fetchedAt);
const searchIndex = buildBuilderSearchIndex(combined.builders, combined.builderLicences, memoryCards);
const duplicateReviewQueue = buildBuilderDuplicateReviewQueue(combined.builders, combined.builderLicences);
const finishedAt = new Date().toISOString();
const summary = summarizeBuilderImport({ ...combined, sourceStats, startedAt, finishedAt });
const qualityReport = summarizeBuilderDataQuality({ ...combined, memoryCards, sourceStats, generatedAt: fetchedAt });
const sources = listBuilderDataSources();
const sourceAccessReport = buildBuilderSourceAccessReport({ sources, sourceStats, generatedAt: fetchedAt });

await writeJson("builders.json", combined.builders);
await writeJson("builder-licences.json", combined.builderLicences);
await writeJson("sources.json", sources);
await writeJson("summary.json", summary);
await writeJson("quality-report.json", qualityReport);
await writeJson("source-access-report.json", sourceAccessReport);
await writeNdjson("builders.ndjson", combined.builders);
await writeNdjson("builder-licences.ndjson", combined.builderLicences);
await writeNdjson("builder-memory-cards.ndjson", memoryCards);
await writeNdjson("builder-search-index.ndjson", searchIndex);
await writeNdjson("builder-duplicate-review.ndjson", duplicateReviewQueue);
await writeManifest({
  startedAt,
  finishedAt,
  summary,
  sources,
  artifacts: [
    { filename: "builders.json", rowCount: combined.builders.length, format: "json" },
    { filename: "builders.ndjson", rowCount: combined.builders.length, format: "ndjson" },
    { filename: "builder-licences.json", rowCount: combined.builderLicences.length, format: "json" },
    { filename: "builder-licences.ndjson", rowCount: combined.builderLicences.length, format: "ndjson" },
    { filename: "builder-memory-cards.ndjson", rowCount: memoryCards.length, format: "ndjson" },
    { filename: "builder-search-index.ndjson", rowCount: searchIndex.length, format: "ndjson" },
    { filename: "builder-duplicate-review.ndjson", rowCount: duplicateReviewQueue.length, format: "ndjson" },
    { filename: "sources.json", rowCount: sources.length, format: "json" },
    { filename: "summary.json", rowCount: 1, format: "json" },
    { filename: "quality-report.json", rowCount: 1, format: "json" },
    { filename: "source-access-report.json", rowCount: 1, format: "json" },
  ],
});

console.log(JSON.stringify(summary, null, 2));

async function fetchQbccRows({ limit, pageSize, fetchedAt }) {
  const source = BUILDER_DATA_SOURCES.QLD_QBCC_LICENSED_CONTRACTORS;
  const mappedRows = [];
  let offset = 0;
  let total = undefined;
  let rawRows = 0;

  while (total === undefined || offset < total) {
    const remaining = limit ? limit - rawRows : pageSize;
    if (remaining <= 0) break;
    const currentLimit = Math.min(pageSize, remaining);
    const url = new URL(source.apiUrl);
    url.searchParams.set("resource_id", source.resourceId);
    url.searchParams.set("limit", String(currentLimit));
    url.searchParams.set("offset", String(offset));
    const data = await fetchJson(url);
    total = data.result.total;
    const records = data.result.records ?? [];
    rawRows += records.length;
    for (const record of records) {
      const mapped = mapQbccRow(record, fetchedAt);
      if (mapped) mappedRows.push(mapped);
    }
    if (!records.length) break;
    offset += records.length;
  }

  return {
    rows: mappedRows,
    stats: {
      sourceId: source.id,
      state: source.state,
      rawRowsRead: rawRows,
      builderRowsAccepted: mappedRows.length,
      totalAvailable: total,
      complete: !limit && total !== undefined && rawRows >= total,
      url: source.url,
    },
  };
}

async function fetchNswRows({ limit, fetchedAt }) {
  const source = BUILDER_DATA_SOURCES.NSW_FAIR_TRADING_CONTRACTOR_LICENCE;
  const tempDir = await mkdtemp(path.join(tmpdir(), "dwella-nsw-"));
  const workbookPath = path.join(tempDir, "contractor-licence.xlsx");
  try {
    const response = await fetch(source.downloadUrl, {
      headers: { "user-agent": "DwellaDataIngest/0.1" },
      redirect: "follow",
    });
    if (!response.ok) {
      throw new Error(`NSW workbook download failed: ${response.status} ${response.statusText}`);
    }
    await writeFile(workbookPath, Buffer.from(await response.arrayBuffer()));
    const records = await parseNswWorkbook(workbookPath);
    const mappedRows = [];
    let rawRows = 0;
    for (const record of records) {
      rawRows += 1;
      if (limit && rawRows > limit) break;
      const mapped = mapNswContractorRow(record, fetchedAt);
      if (mapped) mappedRows.push(mapped);
    }
    return {
      rows: mappedRows,
      stats: {
        sourceId: source.id,
        state: source.state,
        rawRowsRead: limit ? Math.min(rawRows, limit) : rawRows,
        builderRowsAccepted: mappedRows.length,
        totalAvailable: records.length,
        complete: !limit || rawRows >= records.length,
        url: source.url,
      },
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function fetchVicRows({ limit, fetchedAt }) {
  const source = BUILDER_DATA_SOURCES.VIC_BPC_REGISTER;
  const response = await fetch(source.downloadUrl, {
    headers: { "user-agent": "DwellaDataIngest/0.1" },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`VIC CSV download failed: ${response.status} ${response.statusText}`);
  }

  const records = parseCsv(await response.text());
  const mappedRows = [];
  let rawRows = 0;
  for (const record of records) {
    rawRows += 1;
    if (limit && rawRows > limit) break;
    const mapped = mapVicBpcRow(record, fetchedAt);
    if (mapped) mappedRows.push(mapped);
  }

  return {
    rows: mappedRows,
    stats: {
      sourceId: source.id,
      state: source.state,
      rawRowsRead: limit ? Math.min(rawRows, limit) : rawRows,
      builderRowsAccepted: mappedRows.length,
      totalAvailable: records.length,
      complete: !limit || rawRows >= records.length,
      url: source.url,
    },
  };
}

async function fetchWaRows({ limit, fetchedAt }) {
  const source = BUILDER_DATA_SOURCES.WA_BUILDING_ENERGY_REGISTER;
  const tempDir = await mkdtemp(path.join(tmpdir(), "dwella-wa-"));
  const pdfPath = path.join(tempDir, "BuilderRegister.pdf");
  try {
    const response = await fetch(source.downloadUrl, {
      headers: { "user-agent": "DwellaDataIngest/0.1" },
      redirect: "follow",
    });
    if (!response.ok) {
      throw new Error(`WA PDF download failed: ${response.status} ${response.statusText}`);
    }
    await writeFile(pdfPath, Buffer.from(await response.arrayBuffer()));
    const records = await parseWaPdf(pdfPath, limit);
    const mappedRows = [];
    let rawRows = 0;
    for (const record of records) {
      rawRows += 1;
      if (limit && rawRows > limit) break;
      const mapped = mapWaBuilderRow(record, fetchedAt);
      if (mapped) mappedRows.push(mapped);
    }
    return {
      rows: mappedRows,
      stats: {
        sourceId: source.id,
        state: source.state,
        rawRowsRead: limit ? Math.min(rawRows, limit) : rawRows,
        builderRowsAccepted: mappedRows.length,
        totalAvailable: limit ? undefined : records.length,
        complete: !limit,
        url: source.url,
      },
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function fetchActRows({ limit, fetchedAt }) {
  const source = BUILDER_DATA_SOURCES.ACT_ACCESS_CANBERRA_REGISTER;
  const url = new URL(source.apiUrl);
  url.searchParams.set("$limit", "50000");
  const response = await fetchWithRetry(url, {
    headers: { "user-agent": "DwellaDataIngest/0.1" },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`ACT professionals API failed: ${response.status} ${response.statusText}`);
  }
  const records = await response.json();
  const mappedRows = [];
  let rawRows = 0;
  for (const record of records) {
    rawRows += 1;
    if (limit && rawRows > limit) break;
    const mapped = mapActProfessionalRow(record, fetchedAt);
    if (mapped) mappedRows.push(mapped);
  }

  return {
    rows: mappedRows,
    stats: {
      sourceId: source.id,
      state: source.state,
      rawRowsRead: limit ? Math.min(rawRows, limit) : rawRows,
      builderRowsAccepted: mappedRows.length,
      totalAvailable: records.length,
      complete: !limit || rawRows >= records.length,
      url: source.url,
    },
  };
}

async function fetchNtRows({ limit, fetchedAt }) {
  const source = BUILDER_DATA_SOURCES.NT_BPB_REGISTER;
  const listRows = [];
  let totalAvailable = 0;

  for (const category of source.categories) {
    const url = new URL(source.searchUrl);
    url.searchParams.set("category", category);
    url.searchParams.set("status", "ACTIVE");
    url.searchParams.set("Submit", "Search");
    const response = await fetchWithRetry(url, {
      headers: { "user-agent": "DwellaDataIngest/0.1" },
      redirect: "follow",
    });
    if (!response.ok) {
      throw new Error(`NT register search failed: ${response.status} ${response.statusText}`);
    }
    const html = await response.text();
    totalAvailable += Number(html.match(/Records Found:\s*(\d+)/i)?.[1] ?? 0);
    listRows.push(...parseNtResultRows(html, source.detailBaseUrl));
  }

  const selectedRows = limit ? listRows.slice(0, limit) : listRows;
  const detailedRows = await mapConcurrent(selectedRows, 8, async (row) => {
    const response = await fetchWithRetry(row.detailUrl, {
      headers: { "user-agent": "DwellaDataIngest/0.1" },
      redirect: "follow",
    });
    if (!response.ok) {
      throw new Error(`NT register detail failed: ${response.status} ${response.statusText} ${row.detailUrl}`);
    }
    return {
      ...row,
      ...parseNtDetail(await response.text()),
    };
  });
  const mappedRows = detailedRows.map((row) => mapNtBpbRow(row, fetchedAt)).filter(Boolean);

  return {
    rows: mappedRows,
    stats: {
      sourceId: source.id,
      state: source.state,
      rawRowsRead: selectedRows.length,
      builderRowsAccepted: mappedRows.length,
      totalAvailable,
      complete: !limit && selectedRows.length >= totalAvailable,
      url: source.url,
    },
  };
}

async function parseNswWorkbook(workbookPath) {
  const scriptPath = path.join(ROOT, "scripts", "parse-nsw-contractors.py");
  const output = await spawnCapture(PYTHON, [scriptPath, workbookPath]);
  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function parseWaPdf(pdfPath, limit) {
  const scriptPath = path.join(ROOT, "scripts", "parse-wa-builders.py");
  const args = limit ? [scriptPath, pdfPath, String(limit)] : [scriptPath, pdfPath];
  const output = await spawnCapture(PYTHON, args);
  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "user-agent": "DwellaDataIngest/0.1" } });
  if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${response.statusText} ${url}`);
  const data = await response.json();
  if (!data.success) throw new Error(`Source API returned failure: ${JSON.stringify(data.error ?? data)}`);
  return data;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const headers = rows.shift()?.map((header) => header.trim()) ?? [];
  return rows
    .filter((items) => items.some((item) => item.trim()))
    .map((items) => Object.fromEntries(headers.map((header, index) => [header, items[index] ?? ""])));
}

function parseNtResultRows(html, detailBaseUrl) {
  const tbody = html.match(/<tbody>(.*?)<\/tbody>/is)?.[1] ?? "";
  return [...tbody.matchAll(/<tr>(.*?)<\/tr>/gis)]
    .map((match) => match[1])
    .map((rowHtml) => {
      const cells = [...rowHtml.matchAll(/<td[^>]*>(.*?)<\/td>/gis)].map((cell) => cell[1]);
      if (cells.length < 5) return null;
      const href = cells[0].match(/href="([^"]+)"/i)?.[1];
      const name = htmlText(cells[0]);
      if (!href || !name) return null;
      return {
        name,
        contactNumber: htmlText(cells[1]),
        address: htmlText(cells[2]),
        category: htmlText(cells[3]),
        status: htmlText(cells[4]),
        detailUrl: new URL(href, detailBaseUrl).toString(),
      };
    })
    .filter(Boolean);
}

function parseNtDetail(html) {
  const fields = {};
  for (const match of html.matchAll(/<tr>\s*<th[^>]*>(.*?)<\/th>\s*<td[^>]*>(.*?)<\/td>\s*<\/tr>/gis)) {
    fields[toCamelCase(htmlText(match[1]))] = htmlText(match[2]);
  }
  return {
    name: fields.nameOfIndividualOrCompany,
    registrationNumber: fields.registrationNumber,
    category: fields.category,
    scopeOfWorks: fields.scopeOfWorks,
    status: fields.status,
    independentReviewEngineer: fields.independentReviewEngineer,
    postalAddress: fields.postalAddress,
    telephoneNumber: fields.telephoneNumber,
    mobileNumber: fields.mobileNumber,
    activeRegistrationPeriods: fields.activeRegistrationPeriods,
    conditionsOrEndorsements: fields.conditionsOrEndorsements,
    relatedCompanyOrIndividual: fields.relatedCompanyOrIndividual,
  };
}

function htmlText(html) {
  return decodeHtmlEntities(
    String(html ?? "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/li>/gi, "; ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function decodeHtmlEntities(value) {
  return String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function toCamelCase(value) {
  const words = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return words
    .map((word, index) => (index === 0 ? word : `${word[0].toUpperCase()}${word.slice(1)}`))
    .join("");
}

async function mapConcurrent(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function fetchWithRetry(url, options = {}, retryOptions = {}) {
  const attempts = retryOptions.attempts ?? 4;
  const delayMs = retryOptions.delayMs ?? 500;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (response.ok || !isTransientStatus(response.status) || attempt === attempts) {
        return response;
      }
      lastError = new Error(`transient HTTP ${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) {
        throw error;
      }
    }
    await sleep(delayMs * attempt);
  }

  throw lastError;
}

function isTransientStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


async function spawnCapture(command, args) {
  const child = spawn(command, args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const code = await new Promise((resolve) => child.on("close", resolve));
  if (code !== 0) {
    throw new Error(`${command} exited ${code}: ${stderr}`);
  }
  return stdout;
}

async function writeJson(filename, value) {
  await writeFile(path.join(OUTPUT_DIR, filename), `${JSON.stringify(value, null, 2)}\n`);
}

async function writeNdjson(filename, values) {
  await writeFile(path.join(OUTPUT_DIR, filename), `${values.map((value) => JSON.stringify(value)).join("\n")}\n`);
}

async function writeManifest({ startedAt, finishedAt, summary, sources, artifacts }) {
  const files = {};
  for (const artifact of artifacts) {
    const filepath = path.join(OUTPUT_DIR, artifact.filename);
    files[artifact.filename] = {
      format: artifact.format,
      rowCount: artifact.rowCount,
      bytes: (await stat(filepath)).size,
      sha256: await sha256File(filepath),
    };
  }

  await writeJson("manifest.json", {
    schemaVersion: 1,
    generatedAt: finishedAt,
    startedAt,
    finishedAt,
    importedStates: summary.sourceStats.map((source) => source.state),
    pendingStates: ["QLD", "NSW", "VIC", "WA", "SA", "ACT", "TAS", "NT"].filter(
      (state) => !summary.sourceStats.some((source) => source.state === state)
    ),
    totals: summary.totals,
    byState: summary.byState,
    sourceStats: summary.sourceStats,
    sourceRegistry: sources.map((source) => ({
      id: source.id,
      state: source.state,
      type: source.type,
      accessStatus: source.accessStatus,
      url: source.url,
      searchUrl: source.searchUrl,
    })),
    files,
    invariants: {
      builderRowsMatchMemoryCards: files["builders.ndjson"].rowCount === files["builder-memory-cards.ndjson"].rowCount,
      builderRowsMatchSearchIndex: files["builders.ndjson"].rowCount === files["builder-search-index.ndjson"].rowCount,
      builderRowsMatchSummary: files["builders.ndjson"].rowCount === summary.totals.builders,
      licenceRowsMatchSummary: files["builder-licences.ndjson"].rowCount === summary.totals.licences,
    },
    limitations: summary.limitations,
  });
}

async function sha256File(filepath) {
  const hash = createHash("sha256");
  await new Promise((resolve, reject) => {
    createReadStream(filepath)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", resolve);
  });
  return hash.digest("hex");
}

function parseArgs(args) {
  const sources = new Set(["qld", "nsw", "vic", "wa", "act", "nt"]);
  let limit;
  let pageSize;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--source") {
      sources.clear();
      for (const item of args[++index].split(",")) sources.add(item.trim().toLowerCase());
    } else if (arg === "--limit") {
      limit = Number(args[++index]);
    } else if (arg === "--page-size") {
      pageSize = Number(args[++index]);
    } else if (arg === "--help") {
      console.log("Usage: node scripts/import-builders.mjs [--source qld,nsw,vic,wa,act,nt] [--limit n] [--page-size n]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return { sources, limit, pageSize };
}
