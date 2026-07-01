import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_BUILDER_DATA_DIR, assertSafeBuilderArtifactFilename } from "./builderArtifacts.js";
import { BUILDER_DATA_SOURCES } from "./builderDataSources.js";

const REQUIRED_EXTRACT_FIELDS = [
  "licence holder legal name or registered business name",
  "trading name, if published",
  "licence or registration number",
  "licence class or category",
  "licence status",
  "issue date, if published",
  "expiry date, if published",
  "published suburb, postcode or service address, if available",
  "ABN or ACN, if held in the public register",
  "source extract generated date",
];

const ACCEPTABLE_FORMATS = ["CSV", "XLSX", "JSON", "documented API"];

export function buildBuilderSourceAccessRequests({ sources = Object.values(BUILDER_DATA_SOURCES), manifest = {}, sourceAccessReport = {}, generatedAt = new Date().toISOString() } = {}) {
  const pendingStates = sourceAccessReport.pendingStates ?? manifest.pendingStates ?? [];
  const pendingSourceIds = new Set((sourceAccessReport.pendingSources ?? []).map((source) => source.sourceId));
  const candidateSources = sources.filter((source) => pendingStates.includes(source.state) || pendingSourceIds.has(source.id));

  return {
    schemaVersion: 1,
    generatedAt: new Date(generatedAt).toISOString(),
    status: candidateSources.length ? "requests_ready" : "no_pending_sources",
    pendingStates: [...new Set(candidateSources.map((source) => source.state))].sort(),
    requests: candidateSources.map((source) => buildSourceRequest(source)),
    limitations: [
      "This artifact is an operational access-request packet, not builder evidence.",
      "Dwella must not import SA or TAS rows until the regulator supplies a sanctioned extract, documented API, or written permission for the access path.",
      "Any received extract must pass schema, currency, source identity, licensing and row-level validation before it can update builder records.",
    ],
  };
}

export async function writeBuilderSourceAccessRequests(options = {}) {
  const dataDir = options.dataDir ?? DEFAULT_BUILDER_DATA_DIR;
  const outputFile = assertSafeBuilderArtifactFilename(options.outputFile ?? "source-access-requests.json", "source access requests output filename");
  const report = buildBuilderSourceAccessRequests(options);
  await mkdir(dataDir, { recursive: true });
  await writeFile(path.join(dataDir, outputFile), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

function buildSourceRequest(source) {
  const contact = source.accessRequestContact ?? {};
  const evidence = source.accessEvidence ?? [];
  const requestedAccess = {
    purpose: "Current per-builder licence evidence for Dwella's Australian builder memory pipeline.",
    formats: ACCEPTABLE_FORMATS,
    fields: REQUIRED_EXTRACT_FIELDS,
    updateCadence: "Current snapshot plus guidance on refresh frequency or API polling limits.",
    permissionNeeded: "Written confirmation that the supplied extract or API may be used for this production builder evidence pipeline.",
  };
  const officialUrls = [...new Set([source.url, source.searchUrl, ...evidence.map((item) => item.url)].filter(Boolean))];
  return {
    state: source.state,
    sourceId: source.id,
    sourceName: source.name,
    agency: contact.agency ?? source.source,
    contact: {
      email: contact.email ?? null,
      phone: contact.phone ?? null,
      url: contact.url ?? source.url,
      evidenceUrl: contact.evidenceUrl ?? contact.url ?? source.url,
    },
    officialUrls,
    accessStatus: source.accessStatus ?? "manual_connector_required",
    requestStatus: contact.email || contact.url ? "ready_to_send" : "contact_research_required",
    requestedAccess,
    validationBeforeImport: [
      "Confirm the extract is issued by the configured regulator source.",
      "Confirm the extract is current and not a historical point-in-time sample.",
      "Confirm rows are per licence holder or per licence record, not aggregate counts.",
      "Filter to builder or building services provider classes only.",
      "Preserve unknown fields as unknown; do not infer website, ABN, service area, pricing, capacity or quality.",
      "Generate import, quality, source-access, detailed-list and production-readiness artifacts before any Convex import.",
    ],
    prohibitedPaths: [
      "Do not bypass reCAPTCHA or automate protected public search forms.",
      "Do not scrape third-party licence mirrors as official evidence.",
      "Do not import stale open-data snapshots as current builder records.",
      "Do not seed placeholder builders while waiting for access.",
    ],
    requestMessage: buildRequestMessage({ source, contact, requestedAccess, officialUrls }),
    evidence: evidence.map((item) => ({
      checkedAt: item.checkedAt,
      url: item.url,
      finding: item.finding,
      importDecision: item.importDecision,
    })),
  };
}

function buildRequestMessage({ source, contact, requestedAccess, officialUrls }) {
  const subject = `Request for sanctioned ${source.state} builder licence register extract`;
  const greetingName = contact.agency ?? source.source ?? source.name;
  const fieldList = requestedAccess.fields.map((field) => `- ${field}`).join("\n");
  const urlList = officialUrls.map((url) => `- ${url}`).join("\n");
  const body = [
    `Hello ${greetingName} team,`,
    "",
    "I am requesting a sanctioned current extract or documented API access path for the public builder/building services licence records represented in your official register.",
    "",
    "The intended use is Dwella's Australian builder memory pipeline. The pipeline stores source-backed builder licence evidence and keeps unknown fields unknown; it does not infer website, ABN, service area, pricing, capacity or quality from missing data.",
    "",
    "Could you please confirm whether you can provide a current CSV, XLSX, JSON export, or documented API for per-builder or per-licence records with these fields where they are part of the public register:",
    fieldList,
    "",
    `Also please confirm the permitted refresh cadence and provide written permission or terms for using the supplied extract/API in this production evidence pipeline.`,
    "",
    "The public paths we have reviewed are:",
    urlList,
    "",
    "We will not bypass reCAPTCHA, automate protected public search forms, use third-party mirrors as official evidence, or import stale snapshot data as current records.",
    "",
    "Thank you.",
  ].join("\n");

  return {
    subject,
    body,
    bodyFormat: "text/plain",
    evidenceNote: "Generated from official source metadata and access evidence; review before sending.",
  };
}
