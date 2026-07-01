import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { BUILDER_DATA_SOURCES } from "./builderDataSources.js";
import { normalizeState, normalizeText } from "./utils.js";

const REQUIRED_FIELD_GROUPS = [
  {
    field: "licenceHolderName",
    aliases: ["licence holder legal name or registered business name", "licence holder", "licensee", "name", "registered business name", "business name"],
  },
  {
    field: "licenceNumber",
    aliases: ["licence or registration number", "licence number", "license number", "registration number", "permit number"],
  },
  {
    field: "licenceClass",
    aliases: ["licence class or category", "licence class", "license class", "category", "class", "registration category"],
  },
  {
    field: "licenceStatus",
    aliases: ["licence status", "license status", "status"],
  },
];

const RECOMMENDED_FIELD_GROUPS = [
  { field: "tradingName", aliases: ["trading name", "published trading name"] },
  { field: "issueDate", aliases: ["issue date", "commenced", "start date"] },
  { field: "expiryDate", aliases: ["expiry date", "expires", "end date"] },
  { field: "addressOrPostcode", aliases: ["published suburb", "postcode", "service address", "address", "suburb"] },
  { field: "abnOrAcn", aliases: ["abn", "acn", "australian business number", "australian company number"] },
  { field: "sourceExtractGeneratedDate", aliases: ["source extract generated date", "extract generated date", "generated date", "extract date"] },
];

const MINIMUM_ROW_SAMPLE_SIZE = 1;

export async function validateSanctionedBuilderExtractFile(options = {}) {
  if (!options.filepath) throw new Error("filepath is required");
  const text = await readFile(options.filepath, "utf8");
  const fileStat = await stat(options.filepath);
  const extension = path.extname(options.filepath).toLowerCase();
  const parsed = parseExtractText(text, options.format ?? extensionToFormat(extension));
  const permissionEvidence = await buildPermissionEvidence(options.permissionEvidence);
  return validateSanctionedBuilderExtract({
    ...options,
    filename: path.basename(options.filepath),
    inputFile: {
      filename: path.basename(options.filepath),
      bytes: fileStat.size,
      sha256: sha256Text(text),
    },
    permissionEvidence,
    rows: parsed.rows,
    columns: parsed.columns,
    parseFormat: parsed.format,
  });
}

export function validateSanctionedBuilderExtract({
  sourceId,
  state,
  filename = null,
  inputFile = null,
  rows = [],
  columns = [],
  parseFormat = "unknown",
  manifest = {},
  sourceAccessRequests = {},
  permissionEvidence = null,
  generatedAt = new Date().toISOString(),
} = {}) {
  const normalizedState = normalizeState(state);
  const source = sourceId ? BUILDER_DATA_SOURCES[sourceId] : findSourceByState(normalizedState);
  const pendingStates = manifest.pendingStates ?? sourceAccessRequests.pendingStates ?? [];
  const accessRequest = (sourceAccessRequests.requests ?? []).find((request) => request.sourceId === source?.id || request.state === source?.state);
  const fieldMap = buildFieldMap(columns);
  const rowStats = inspectRows(rows, fieldMap);
  const checks = [
    makeCheck("source_configured", Boolean(source), source ? `${source.id} configured for ${source.state}.` : "No configured source matched the supplied source/state."),
    makeCheck(
      "source_is_pending_jurisdiction",
      Boolean(source && pendingStates.includes(source.state)),
      source ? `${source.state} pending states: ${pendingStates.join(", ") || "none"}.` : "No source state available."
    ),
    makeCheck(
      "access_request_ready",
      accessRequest?.requestStatus === "ready_to_send",
      accessRequest ? `Access request status is ${accessRequest.requestStatus}.` : "No source access request packet found."
    ),
    makeCheck("file_parsed", rows.length >= MINIMUM_ROW_SAMPLE_SIZE, `${rows.length} row${rows.length === 1 ? "" : "s"} parsed from ${filename ?? "extract"}.`),
    ...REQUIRED_FIELD_GROUPS.map((group) =>
      makeCheck(
        `required_field_${group.field}`,
        Boolean(fieldMap[group.field]),
        fieldMap[group.field] ? `Mapped ${group.field} to "${fieldMap[group.field]}".` : `Missing required field: ${group.field}.`
      )
    ),
    makeCheck(
      "builder_class_filter_possible",
      rowStats.builderClassRows > 0,
      `${rowStats.builderClassRows} row${rowStats.builderClassRows === 1 ? "" : "s"} mention builder/building in the mapped class/category field.`
    ),
    makeCheck(
      "licence_numbers_present",
      rowStats.rowsWithLicenceNumber === rows.length && rows.length > 0,
      `${rowStats.rowsWithLicenceNumber}/${rows.length} parsed rows have licence numbers.`
    ),
    makeCheck(
      "names_present",
      rowStats.rowsWithName === rows.length && rows.length > 0,
      `${rowStats.rowsWithName}/${rows.length} parsed rows have licence holder names.`
    ),
    makeCheck(
      "permission_evidence_present",
      hasPermissionEvidence(permissionEvidence),
      permissionEvidence
        ? `Permission evidence supplied for review${permissionEvidence.file?.sha256 ? ` with file SHA-256 ${permissionEvidence.file.sha256}.` : "."}`
        : "No written permission evidence supplied."
    ),
  ];
  const recommendedFields = RECOMMENDED_FIELD_GROUPS.map((group) => ({
    field: group.field,
    mappedColumn: fieldMap[group.field] ?? null,
    present: Boolean(fieldMap[group.field]),
  }));
  const hardFailures = checks.filter((check) => !check.ok).map((check) => check.checkId);
  const importDecision = hardFailures.length === 0 ? "ready_for_mapper_implementation" : "not_importable";

  return {
    schemaVersion: 1,
    generatedAt: new Date(generatedAt).toISOString(),
    filename,
    inputFile,
    parseFormat,
    sourceId: source?.id ?? sourceId ?? null,
    state: source?.state ?? normalizedState ?? null,
    importDecision,
    checks,
    hardFailures,
    columns,
    mappedFields: fieldMap,
    recommendedFields,
    rowStats,
    permissionEvidence: permissionEvidence ?? null,
    limitations: [
      "This validates a supplied regulator extract for staging only; it does not import builder records.",
      "A ready result means the file can be used to implement a source-specific mapper and review workflow, not that rows are automatically trusted.",
      "Unknown website, ABN, service area, pricing, capacity and quality fields must remain unknown unless supplied by evidence.",
    ],
  };
}

function sha256Text(text) {
  return createHash("sha256").update(text).digest("hex");
}

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function buildPermissionEvidence(permissionEvidence) {
  if (!permissionEvidence) return null;
  const filepath = trimPermissionValue(permissionEvidence.filepath);
  const normalized = {
    reference: trimPermissionValue(permissionEvidence.reference),
  };
  if (permissionEvidence.file) normalized.file = permissionEvidence.file;
  if (filepath && !normalized.file) {
    const bytes = await readFile(filepath);
    const fileStat = await stat(filepath);
    normalized.file = {
      filename: path.basename(filepath),
      bytes: fileStat.size,
      sha256: sha256Bytes(bytes),
    };
  }
  if (!normalized.reference && !normalized.file) return null;
  return normalized;
}

function trimPermissionValue(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

function hasPermissionEvidence(permissionEvidence) {
  return Boolean(normalizeText(permissionEvidence?.reference) || permissionEvidence?.file?.sha256);
}

export function parseExtractText(text, format = "json") {
  if (format === "json") {
    const parsed = JSON.parse(text);
    const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed.rows) ? parsed.rows : [];
    return { format, rows, columns: collectColumns(rows) };
  }
  if (format === "ndjson") {
    const rows = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    return { format, rows, columns: collectColumns(rows) };
  }
  if (format === "csv") {
    const rows = parseCsv(text);
    return { format, rows, columns: collectColumns(rows) };
  }
  throw new Error(`Unsupported extract format: ${format}`);
}

function extensionToFormat(extension) {
  if (extension === ".json") return "json";
  if (extension === ".ndjson" || extension === ".jsonl") return "ndjson";
  if (extension === ".csv") return "csv";
  return "json";
}

function buildFieldMap(columns) {
  const normalizedColumns = new Map(columns.map((column) => [normalizeHeader(column), column]));
  const fieldMap = {};
  for (const group of [...REQUIRED_FIELD_GROUPS, ...RECOMMENDED_FIELD_GROUPS]) {
    const match = group.aliases.map(normalizeHeader).find((alias) => normalizedColumns.has(alias));
    if (match) fieldMap[group.field] = normalizedColumns.get(match);
  }
  return fieldMap;
}

function inspectRows(rows, fieldMap) {
  let rowsWithName = 0;
  let rowsWithLicenceNumber = 0;
  let builderClassRows = 0;
  const classColumn = fieldMap.licenceClass;
  const nameColumn = fieldMap.licenceHolderName;
  const licenceNumberColumn = fieldMap.licenceNumber;
  for (const row of rows) {
    if (normalizeText(row?.[nameColumn])) rowsWithName += 1;
    if (normalizeText(row?.[licenceNumberColumn])) rowsWithLicenceNumber += 1;
    if (/\b(build|builder|building)\b/i.test(String(row?.[classColumn] ?? ""))) builderClassRows += 1;
  }
  return {
    rows: rows.length,
    rowsWithName,
    rowsWithLicenceNumber,
    builderClassRows,
  };
}

function collectColumns(rows) {
  return [...new Set(rows.flatMap((row) => Object.keys(row ?? {})))];
}

function findSourceByState(state) {
  return Object.values(BUILDER_DATA_SOURCES).find((source) => source.state === state && source.type === "manual_connector_required");
}

function makeCheck(checkId, ok, detail) {
  return { checkId, ok: Boolean(ok), detail };
}

function normalizeHeader(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [headers = [], ...dataRows] = rows.filter((item) => item.some((value) => String(value).trim()));
  return dataRows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [String(header).trim(), String(values[index] ?? "").trim()]))
  );
}
