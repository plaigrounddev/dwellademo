import { BUILDER_DATA_SOURCES } from "./builderDataSources.js";

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_USER_AGENT = "DwellaSourceAccessRecheck/0.1";

export async function recheckPendingBuilderSourceAccess({
  sources = Object.values(BUILDER_DATA_SOURCES),
  fetchImpl = globalThis.fetch,
  checkedAt = new Date().toISOString().slice(0, 10),
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("fetch implementation is required");
  const pendingSources = sources.filter((source) => source.type === "manual_connector_required");
  const results = [];

  for (const source of pendingSources) {
    const probes = [];
    for (const url of unique([source.url, source.searchUrl, ...source.accessEvidence?.map((item) => item.url) ?? []])) {
      probes.push(await probeUrl({ url, source, fetchImpl, checkedAt, timeoutMs }));
    }
    results.push(summarizeSourceProbe(source, probes, checkedAt));
  }

  return {
    schemaVersion: 1,
    checkedAt,
    pendingStates: unique(results.map((result) => result.state)).sort(),
    results,
    limitations: [
      "This recheck performs read-only HTTP fetches against configured official source URLs.",
      "It does not bypass reCAPTCHA, Cloudflare, Salesforce/Aura rendering controls, login walls or form submissions.",
      "A source remains excluded from builder records until a production-safe official extract, documented API or sanctioned access path is available.",
    ],
  };
}

export function toConvexSourceAccessRecheck(report, importId) {
  return {
    importId,
    checkedAt: report.checkedAt,
    pendingStates: report.pendingStates ?? [],
    resultsJson: JSON.stringify(report.results ?? []),
    limitations: report.limitations ?? [],
  };
}

export function summarizeSourceProbe(source, probes, checkedAt = new Date().toISOString().slice(0, 10)) {
  const accessibleBulkProbe = probes.find((probe) => probe.importDecision === "candidate_bulk_or_api_requires_review");
  const blockedProbe = probes.find((probe) => probe.importDecision === "pending_sanctioned_bulk_extract_or_api");
  const documentedApiProbe = probes.find((probe) => probe.importDecision === "pending_official_extract_or_documented_api");
  const notUsableProbe = probes.find((probe) => probe.importDecision === "not_used_for_import");
  const accessStatus = accessibleBulkProbe
    ? "candidate_bulk_or_api_requires_review"
    : source.accessStatus ?? blockedProbe?.accessStatus ?? documentedApiProbe?.accessStatus ?? notUsableProbe?.accessStatus ?? "manual_review_required";

  return {
    checkedAt,
    state: source.state,
    sourceId: source.id,
    sourceName: source.name,
    configuredAccessStatus: source.accessStatus ?? "manual_connector_required",
    observedAccessStatus: accessStatus,
    importDecision: accessibleBulkProbe ? "manual_review_before_import" : "not_imported",
    probes,
    notes: accessibleBulkProbe
      ? "A possible bulk/API path was detected by a read-only probe. Review schema, licence and official status before importing."
      : source.notes,
  };
}

async function probeUrl({ url, source, fetchImpl, checkedAt, timeoutMs }) {
  const priorEvidence = source.accessEvidence?.find((item) => item.url === url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": DEFAULT_USER_AGENT, accept: "text/html,application/json,text/plain,*/*" },
    });
    const contentType = response.headers?.get?.("content-type") ?? "";
    const text = await response.text();
    return classifyProbe({
      checkedAt,
      url,
      source,
      priorEvidence,
      status: response.status,
      ok: response.ok,
      contentType,
      text: text.slice(0, 250000),
    });
  } catch (error) {
    return {
      checkedAt,
      url,
      httpStatus: null,
      ok: false,
      accessStatus: "fetch_failed",
      finding: `Read-only source probe failed: ${error instanceof Error ? error.message : String(error)}`,
      importDecision: "not_used_for_import",
      signals: [],
    };
  } finally {
    clearTimeout(timeout);
  }
}

function classifyProbe({ checkedAt, url, source, priorEvidence, status, ok, contentType, text }) {
  const signals = detectSignals(text, contentType, url);
  const httpStatus = status;
  let accessStatus = source.accessStatus ?? "manual_review_required";
  let importDecision = "not_used_for_import";
  let finding = `Read-only probe returned HTTP ${status}. No production-safe current builder extract was identified.`;

  if (priorEvidence?.importDecision?.startsWith("rejected_")) {
    accessStatus = "rejected_candidate_still_present";
    importDecision = priorEvidence.importDecision;
    finding = `${priorEvidence.finding} Read-only recheck still reached the same candidate URL; it remains excluded from import.`;
  } else if (priorEvidence?.importDecision === "not_used_for_import") {
    accessStatus = "official_page_without_bulk_extract";
    importDecision = "not_used_for_import";
    finding = `${priorEvidence.finding} Read-only recheck still reached the same official page; it remains documentation evidence only.`;
  } else if (signals.includes("recaptcha")) {
    accessStatus = "blocked_by_public_search_recaptcha";
    importDecision = "pending_sanctioned_bulk_extract_or_api";
    finding = "Read-only probe found reCAPTCHA markers on the public register/search path.";
  } else if (signals.includes("cloudflare_challenge")) {
    accessStatus = "blocked_by_cloudflare_challenge";
    importDecision = "pending_official_extract_or_documented_api";
    finding = "Read-only probe found Cloudflare challenge markers; no official extract was identified from this response.";
  } else if (signals.includes("salesforce_aura")) {
    accessStatus = "public_salesforce_register_endpoint_not_identified";
    importDecision = "pending_official_extract_or_documented_api";
    finding = "Read-only probe found Salesforce/Aura public-register rendering; no stable documented server-side extract endpoint was identified.";
  } else if (signals.includes("ckan_dataset") || signals.includes("csv_link") || signals.includes("xlsx_link") || signals.includes("json_api")) {
    accessStatus = "candidate_bulk_or_api_requires_review";
    importDecision = "candidate_bulk_or_api_requires_review";
    finding = "Read-only probe found a possible bulk/API signal. This must be manually reviewed for currency, licence and per-builder fields before import.";
  } else if (!ok) {
    accessStatus = "http_error";
    finding = `Read-only probe returned HTTP ${status}; no usable current official builder extract was identified.`;
  }

  return {
    checkedAt,
    url,
    httpStatus,
    ok,
    contentType,
    accessStatus,
    finding,
    importDecision,
    signals,
  };
}

function detectSignals(text, contentType, url) {
  const haystack = `${url}\n${contentType}\n${text}`.toLowerCase();
  const signals = [];
  if (/recaptcha|g-recaptcha|google\.com\/recaptcha/.test(haystack)) signals.push("recaptcha");
  if (/cf-chl|cloudflare|cf-ray|challenge-platform/.test(haystack)) signals.push("cloudflare_challenge");
  if (/aura\.context|aura\.framework|\/s\/sfsites\/aura|salesforce/.test(haystack)) signals.push("salesforce_aura");
  if (/datastore_search|\/api\/3\/action|ckan|data\.[a-z]+\.gov/.test(haystack)) signals.push("ckan_dataset");
  if (/\.csv(?:\?|["'<\s])|text\/csv/.test(haystack)) signals.push("csv_link");
  if (/\.xlsx(?:\?|["'<\s])|spreadsheetml/.test(haystack)) signals.push("xlsx_link");
  if (/application\/json|\.json(?:\?|["'<\s])|api/.test(haystack)) signals.push("json_api");
  return unique(signals);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
