import { BackendError, assertRequired } from "./errors.js";
import {
  DEFAULT_BUILDER_DATA_DIR,
  getBuilderArtifactEvidence,
  readBuilderArtifactManifest,
  searchBuilderArtifacts,
  searchBuilderDuplicateReviewArtifacts,
} from "./builderArtifacts.js";
import { getBuilderCoverageStatus } from "./builderCoverageStatus.js";
import { writeDetailedBuilderList } from "./builderDetailedList.js";
import { getBuilderEnrichmentPlan } from "./builderEnrichmentPlan.js";
import { AUSTRALIAN_CONTACT_ZONES, BUILDER_CONTACT_POLICY } from "./policies.js";
import { compactArray, getLocalParts, minutesSinceMidnight, normalizeState, normalizeText, requireEntity } from "./utils.js";

function scoreBuilder(builder, memoryCard, search) {
  let score = 0;
  const reasons = [];
  const queryState = normalizeState(search.state);
  const text = normalizeText([
    builder.name,
    ...(builder.tradingNames ?? []),
    ...(builder.serviceRegions ?? []),
    ...(builder.homeTypes ?? []),
    builder.builderType,
    memoryCard?.searchableText,
    memoryCard?.markdown,
  ].join(" "));

  if (queryState && builder.states?.includes(queryState)) {
    score += 30;
    reasons.push(`licensed or recorded in ${queryState}`);
  }

  for (const field of ["suburb", "postcode", "projectType", "homeType"]) {
    const value = normalizeText(search[field]);
    if (value && text.includes(value)) {
      score += 12;
      reasons.push(`matches ${field}: ${search[field]}`);
    }
  }

  for (const mustHave of compactArray(search.mustHaves)) {
    if (text.includes(normalizeText(mustHave))) {
      score += 5;
      reasons.push(`mentions ${mustHave}`);
    }
  }

  return { score, reasons: [...new Set(reasons)] };
}

export function createBuildersService(repo, options = {}) {
  const artifactDataDir = options.artifactDataDir ?? DEFAULT_BUILDER_DATA_DIR;

  function searchMemory(search) {
    const builders = repo.list("builders", (builder) => builder.status !== "hidden" && builder.status !== "do_not_contact");
    return builders
      .map((builder) => {
        const memoryCard = repo.list("builderMemoryCards", (card) => card.builderId === builder.id)[0];
        const { score, reasons } = scoreBuilder(builder, memoryCard, search ?? {});
        return {
          builderId: builder.id,
          name: builder.name,
          score,
          appearsSuitable: score > 0,
          reasons,
          confidence: memoryCard?.confidence ?? 0,
          unknowns: buildUnknowns(builder, memoryCard),
        };
      })
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score || b.confidence - a.confidence);
  }

  function getEvidencePack(builderId) {
    const builder = requireEntity(repo.get("builders", builderId), "builders", builderId);
    return {
      builder,
      licences: repo.list("builderLicences", (licence) => licence.builderId === builderId),
      websiteSnapshots: repo.list("builderWebsiteSnapshots", (snapshot) => snapshot.builderId === builderId),
      memoryCards: repo.list("builderMemoryCards", (card) => card.builderId === builderId),
      contactEvents: repo.list("builderContactEvents", (event) => event.builderId === builderId),
    };
  }

  function getOfficialArtifactManifest(overrides = {}) {
    return readBuilderArtifactManifest(overrides.dataDir ?? artifactDataDir);
  }

  function getOfficialCoverageStatus(overrides = {}) {
    return getBuilderCoverageStatus(overrides.dataDir ?? artifactDataDir);
  }

  function getOfficialEnrichmentPlan(overrides = {}) {
    return getBuilderEnrichmentPlan({ ...overrides, dataDir: overrides.dataDir ?? artifactDataDir });
  }

  function writeOfficialDetailedList(overrides = {}) {
    return writeDetailedBuilderList({ ...overrides, dataDir: overrides.dataDir ?? artifactDataDir });
  }

  function searchOfficialArtifacts(search, overrides = {}) {
    return searchBuilderArtifacts(search, { ...overrides, dataDir: overrides.dataDir ?? artifactDataDir });
  }

  function getOfficialArtifactEvidence(builderId, overrides = {}) {
    return getBuilderArtifactEvidence(builderId, { ...overrides, dataDir: overrides.dataDir ?? artifactDataDir });
  }

  function searchOfficialDuplicateReviews(search, overrides = {}) {
    return searchBuilderDuplicateReviewArtifacts(search, { ...overrides, dataDir: overrides.dataDir ?? artifactDataDir });
  }

  function generateMemoryCard(builderId) {
    const evidence = getEvidencePack(builderId);
    const latestWebsite = [...evidence.websiteSnapshots].sort((a, b) => b.lastCrawledAt - a.lastCrawledAt)[0];
    const licenceLines = evidence.licences.map((licence) => {
      const checked = licence.lastCheckedAt ? new Date(licence.lastCheckedAt).toISOString().slice(0, 10) : "check date unknown";
      return `${licence.source} ${licence.licenceNumber}, ${licence.state}, ${licence.status ?? "status unknown"}, checked ${checked}`;
    });
    const sourceIds = [
      ...evidence.licences.map((licence) => licence.id),
      ...evidence.websiteSnapshots.map((snapshot) => snapshot.id),
    ].filter(Boolean);
    const confidenceValues = [
      ...evidence.licences.map((licence) => licence.confidence),
      ...evidence.websiteSnapshots.map((snapshot) => snapshot.confidence),
    ].filter((value) => typeof value === "number");
    const confidence = confidenceValues.length
      ? Number((confidenceValues.reduce((sum, item) => sum + item, 0) / confidenceValues.length).toFixed(2))
      : 0;
    const limitations = buildUnknowns(evidence.builder, evidence.memoryCards[0]);
    if (!evidence.licences.length) limitations.push("licence evidence not recorded");
    if (!latestWebsite) limitations.push("website summary not recorded");

    const markdown = `# Builder Memory Card

Builder: ${evidence.builder.name}
States: ${evidence.builder.states?.join(", ") || "unknown"}
Regions: ${evidence.builder.serviceRegions?.join(", ") || "unknown"}
Website: ${evidence.builder.websiteUrl ?? "unknown"}
ABN: ${evidence.builder.abn ?? "unknown"}
Licence: ${licenceLines.length ? licenceLines.join("; ") : "unknown"}
Builder type: ${evidence.builder.builderType ?? "unknown"}
Likely price tier: ${evidence.builder.priceTier ?? "unknown"}${evidence.builder.priceEvidence ? `, based on ${evidence.builder.priceEvidence}` : ""}
Typical project fit: ${[...(evidence.builder.homeTypes ?? []), latestWebsite?.extractedSummary].filter(Boolean).join("; ") || "unknown"}
Evidence:
${sourceIds.length ? sourceIds.map((sourceId) => `- ${sourceId}`).join("\n") : "- No evidence sources recorded"}
Known limitations:
${limitations.length ? limitations.map((item) => `- ${item}`).join("\n") : "- None recorded"}
Last refreshed: ${new Date().toISOString().slice(0, 10)}
Confidence: ${confidence}
`;

    return repo.insert("builderMemoryCards", {
      builderId,
      markdown,
      searchableText: [
        evidence.builder.name,
        ...(evidence.builder.tradingNames ?? []),
        ...(evidence.builder.states ?? []),
        ...(evidence.builder.serviceRegions ?? []),
        ...(evidence.builder.homeTypes ?? []),
        evidence.builder.builderType,
        evidence.builder.priceTier,
        latestWebsite?.extractedSummary,
      ]
        .filter(Boolean)
        .join(" "),
      sourceIds,
      lastGeneratedAt: Date.now(),
      confidence,
      ragNamespace: "builders",
    });
  }

  async function refreshBuilderProfile(builderId, integrations = {}) {
    const builder = requireEntity(repo.get("builders", builderId), "builders", builderId);
    if (typeof integrations.fetchProfile !== "function") {
      throw new BackendError("integration.missing", "refreshBuilderProfile requires a fetchProfile integration");
    }

    const profile = await integrations.fetchProfile(builder);
    if (!profile || typeof profile !== "object") {
      throw new BackendError("integration.invalid_response", "fetchProfile must return a builder profile object");
    }

    return repo.patch("builders", builderId, {
      ...profile,
      lastEnrichedAt: Date.now(),
    });
  }

  async function classifyWebsite(builderId, integrations = {}) {
    const builder = requireEntity(repo.get("builders", builderId), "builders", builderId);
    if (!builder.websiteUrl) {
      throw new BackendError("builder.website_missing", "Builder has no website URL to classify");
    }
    if (typeof integrations.fetchWebsiteText !== "function" || typeof integrations.classifier !== "function") {
      throw new BackendError("integration.missing", "classifyWebsite requires fetchWebsiteText and classifier integrations");
    }

    const rawText = await integrations.fetchWebsiteText(builder.websiteUrl);
    const classified = await integrations.classifier({ builder, rawText });
    return repo.insert("builderWebsiteSnapshots", {
      builderId,
      url: builder.websiteUrl,
      title: classified.title,
      extractedSummary: classified.extractedSummary,
      extractedCapabilities: classified.extractedCapabilities ?? {},
      priceSignals: classified.priceSignals ?? { publishedPricesFound: false },
      contactDetails: classified.contactDetails ?? {},
      lastCrawledAt: Date.now(),
      confidence: classified.confidence ?? 0,
    });
  }

  function getContactPolicy(builderId, at = new Date()) {
    const builder = requireEntity(repo.get("builders", builderId), "builders", builderId);
    const state = builder.states?.map(normalizeState).find(Boolean);
    const zone = AUSTRALIAN_CONTACT_ZONES[state] ?? AUSTRALIAN_CONTACT_ZONES.NSW;
    const local = getLocalParts(at, zone.timezone);
    const minutes = minutesSinceMidnight(local);
    const dayAllowed = BUILDER_CONTACT_POLICY.email.allowedDays.includes(local.weekday);
    const inEmailWindow = dayAllowed && minutes >= 9 * 60 && minutes <= 15 * 60 + 30 && !(local.weekday === "Friday" && minutes > 12 * 60);
    const inPhoneWindow = dayAllowed && minutes >= 10 * 60 && minutes <= 15 * 60 && !(local.weekday === "Friday" && minutes > 12 * 60);

    return {
      state: state ?? "unknown",
      timezone: zone.timezone,
      policy: BUILDER_CONTACT_POLICY,
      local,
      canEmailNow: inEmailWindow,
      canPhoneNow: inPhoneWindow,
      requiresUserApproval: true,
      recommendation: inEmailWindow
        ? "Email is inside the preferred local builder contact window."
        : "Draft the message and schedule it for the next preferred local builder contact window unless the user approves sending now.",
    };
  }

  return {
    searchMemory,
    getEvidencePack,
    getOfficialArtifactManifest,
    getOfficialCoverageStatus,
    getOfficialEnrichmentPlan,
    writeOfficialDetailedList,
    searchOfficialArtifacts,
    getOfficialArtifactEvidence,
    searchOfficialDuplicateReviews,
    generateMemoryCard,
    refreshBuilderProfile,
    classifyWebsite,
    getContactPolicy,
  };
}

function buildUnknowns(builder, memoryCard) {
  const unknowns = [];
  if (!builder.websiteUrl) unknowns.push("website not recorded");
  if (!builder.abn) unknowns.push("ABN not recorded");
  if (!builder.serviceRegions?.length) unknowns.push("service regions not recorded");
  if (!memoryCard) unknowns.push("builder memory card not generated");
  return unknowns;
}
