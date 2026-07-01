import { BUILDER_DATA_SOURCES } from "./builderDataSources.js";
import { LICENCE_SOURCES_BY_STATE } from "./policies.js";
import { normalizeState, normalizeText } from "./utils.js";

const BUILDER_CLASS_RE = /\bbuilder\b/i;
const POSTCODE_RE = /\b(\d{4})\b/;

export function isBuilderLicenceClass(value) {
  return BUILDER_CLASS_RE.test(String(value ?? ""));
}

export function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function normalizeBusinessNumber(value) {
  const normalized = String(value ?? "").replace(/[^\d]/g, "");
  return normalized || undefined;
}

export function extractPostcode(address) {
  return String(address ?? "").match(POSTCODE_RE)?.[1];
}

export function mapQbccRow(row, fetchedAt = Date.now()) {
  const licenceClass = normalizeWhitespace(row["Licence Class Type"]);
  if (!isBuilderLicenceClass(licenceClass)) return null;
  const name = normalizeWhitespace(row["Licensee Name"]);
  const licenceNumber = normalizeWhitespace(row["Licence Number"]);
  if (!name || !licenceNumber) return null;
  const address = normalizeWhitespace(row["Licensee Business Address"]);
  const source = BUILDER_DATA_SOURCES.QLD_QBCC_LICENSED_CONTRACTORS;

  return {
    sourceId: source.id,
    sourceUrl: source.url,
    state: "QLD",
    source: source.source,
    licenceNumber,
    name,
    tradingNames: [],
    address,
    postcode: extractPostcode(address),
    abn: normalizeBusinessNumber(row.ABN),
    acn: normalizeBusinessNumber(row.ACN),
    licenceClass,
    licenceType: normalizeWhitespace(row["Licence Type DESC"]),
    financialCategory: normalizeWhitespace(row["Financial Category DESC"]),
    licenceGrade: normalizeWhitespace(row["Licence Grade"]),
    status: "unverified",
    lastCheckedAt: fetchedAt,
    confidence: 0.82,
    raw: row,
  };
}

export function mapNswContractorRow(row, fetchedAt = Date.now()) {
  const classes = splitClasses(row.Classes);
  const builderClasses = classes.filter(isBuilderLicenceClass);
  if (!builderClasses.length) return null;
  const name = normalizeWhitespace(row.Licensee);
  const licenceNumber = normalizeWhitespace(row["Licence Number"]);
  if (!name || !licenceNumber) return null;
  const address = normalizeWhitespace(row.Address);
  const source = BUILDER_DATA_SOURCES.NSW_FAIR_TRADING_CONTRACTOR_LICENCE;

  return {
    sourceId: source.id,
    sourceUrl: source.url,
    state: "NSW",
    source: source.source,
    licenceNumber,
    name,
    tradingNames: [],
    address,
    postcode: extractPostcode(address),
    abn: normalizeBusinessNumber(row.ABN),
    acn: normalizeBusinessNumber(row.ACN),
    licenceClass: builderClasses.join("; "),
    licenceType: normalizeWhitespace(row.sheetName),
    issueDate: row["Issue Date"] ? toIsoDate(row["Issue Date"]) : undefined,
    expiryDate: row["Expiry Date"] ? toIsoDate(row["Expiry Date"]) : undefined,
    status: isExpired(row["Expiry Date"], fetchedAt) ? "expired_or_stale_extract" : "current_extract",
    lastCheckedAt: fetchedAt,
    confidence: 0.78,
    raw: row,
  };
}

export function mapVicBpcRow(row, fetchedAt = Date.now()) {
  const licenceClass = normalizeWhitespace(row.Limitation);
  if (!isBuilderLicenceClass(licenceClass)) return null;
  const name = normalizeWhitespace(row["Account Name"]);
  const licenceNumber = normalizeWhitespace(row["Accreditation ID"]);
  if (!name || !licenceNumber) return null;
  const source = BUILDER_DATA_SOURCES.VIC_BPC_REGISTER;

  return {
    sourceId: source.id,
    sourceUrl: source.url,
    state: "VIC",
    source: source.source,
    licenceNumber,
    name,
    tradingNames: [],
    address: undefined,
    postcode: undefined,
    abn: normalizeBusinessNumber(row.ABN),
    acn: normalizeBusinessNumber(row.ACN),
    licenceClass,
    licenceType: normalizeWhitespace(row.Type),
    status: normalizeWhitespace(row["Accreditation Status"]) || "unknown",
    issueDate: parseAuDate(row.Commenced),
    expiryDate: parseAuDate(row.Expires),
    lastCheckedAt: fetchedAt,
    confidence: 0.8,
    raw: row,
  };
}

export function mapWaBuilderRow(row, fetchedAt = Date.now()) {
  const name = normalizeWhitespace(row.name);
  const licenceNumber = normalizeWhitespace(row.registrationNumber);
  if (!name || !licenceNumber) return null;
  const address = normalizeWhitespace(row.businessAddress);
  const source = BUILDER_DATA_SOURCES.WA_BUILDING_ENERGY_REGISTER;

  return {
    sourceId: source.id,
    sourceUrl: source.url,
    state: "WA",
    source: source.source,
    licenceNumber,
    name,
    tradingNames: [],
    address,
    postcode: extractPostcode(address),
    abn: undefined,
    acn: undefined,
    licenceClass: "Building Contractor",
    licenceType: "Current building contractor",
    status: normalizeWhitespace(row.status) || "Current",
    issueDate: parseAuDate(row.registeredDate),
    lastCheckedAt: fetchedAt,
    confidence: 0.74,
    restrictions: Array.isArray(row.restrictions) ? row.restrictions.map(normalizeWhitespace).filter(Boolean) : [],
    firstNominatedSupervisor: normalizeWhitespace(row.firstNominatedSupervisor),
    formerRegistrationNumber: normalizeWhitespace(row.formerRegistrationNumber),
    raw: row,
  };
}

export function mapActProfessionalRow(row, fetchedAt = Date.now()) {
  const occupation = normalizeWhitespace(row.occupation ?? row.Occupation);
  const description = normalizeWhitespace(row.description ?? row.Description);
  if (normalizeText(occupation) !== "builder") return null;
  if (normalizeText(description) === "owner builder") return null;
  const status = normalizeWhitespace(row.licence_status ?? row["Licence Status"]);
  if (status && normalizeText(status) !== "active") return null;
  const licenceNumber = normalizeWhitespace(row.cola_licence_number ?? row["COLA Licence Number"]);
  const surname = normalizeWhitespace(row.surname ?? row.Surname);
  const givenNames = normalizeWhitespace(row.given_names ?? row["Given Names"]);
  const name = normalizeWhitespace([givenNames, surname].filter(Boolean).join(" "));
  if (!name || !licenceNumber) return null;
  const classCondition = normalizeWhitespace(row.class_condition ?? row["Class Condition"]);
  const endorsement = normalizeWhitespace(row.endorsement ?? row.Endorsement);
  const source = BUILDER_DATA_SOURCES.ACT_ACCESS_CANBERRA_REGISTER;

  return {
    sourceId: source.id,
    sourceUrl: source.url,
    state: "ACT",
    source: source.source,
    licenceNumber,
    name,
    tradingNames: [],
    address: undefined,
    postcode: undefined,
    abn: undefined,
    acn: normalizeBusinessNumber(row.licensee_acn ?? row["Licensee ACN"]),
    licenceClass: normalizeWhitespace(["Builder", description].filter(Boolean).join(" - ")),
    licenceType: occupation,
    status: status || "Active",
    expiryDate: parseAuDate(row.expiry_date ?? row["Expiry Date"]),
    lastCheckedAt: fetchedAt,
    confidence: 0.72,
    restrictions: [classCondition, endorsement].filter(Boolean),
    raw: row,
  };
}

export function mapNtBpbRow(row, fetchedAt = Date.now()) {
  const name = normalizeWhitespace(row.name);
  const licenceNumber = normalizeWhitespace(row.registrationNumber);
  if (!name || !licenceNumber) return null;
  const address = normalizeWhitespace(row.postalAddress ?? row.address);
  const source = BUILDER_DATA_SOURCES.NT_BPB_REGISTER;

  return {
    sourceId: source.id,
    sourceUrl: source.url,
    state: "NT",
    source: source.source,
    licenceNumber,
    name,
    tradingNames: [],
    address,
    postcode: extractPostcode(address),
    abn: undefined,
    acn: undefined,
    licenceClass: normalizeWhitespace(row.category),
    licenceType: normalizeWhitespace(row.category),
    status: normalizeWhitespace(row.status) || "ACTIVE",
    issueDate: firstRegistrationStart(row.activeRegistrationPeriods),
    expiryDate: lastRegistrationEnd(row.activeRegistrationPeriods),
    lastCheckedAt: fetchedAt,
    confidence: 0.76,
    restrictions: [normalizeWhitespace(row.conditionsOrEndorsements)].filter(Boolean),
    contactNumber: normalizeWhitespace(row.telephoneNumber),
    mobileNumber: normalizeWhitespace(row.mobileNumber),
    independentReviewEngineer: normalizeWhitespace(row.independentReviewEngineer),
    relatedCompanyOrIndividual: normalizeWhitespace(row.relatedCompanyOrIndividual),
    raw: row,
  };
}

export function combineLicenceRows(rows) {
  const builders = new Map();
  const builderLicences = [];

  for (const row of rows.filter(Boolean)) {
    const builderKey = makeBuilderKey(row);
    const builderId = `builder:${builderKey}`;
    const existing = builders.get(builderId);
    const serviceRegions = [row.postcode].filter(Boolean);
    const homeTypes = inferHomeTypes(row.licenceClass);

    if (!existing) {
      builders.set(builderId, {
        id: builderId,
        name: row.name,
        tradingNames: row.tradingNames ?? [],
        websiteUrl: undefined,
        abn: row.abn,
        acn: row.acn,
        states: [row.state],
        serviceRegions,
        builderType: "unknown",
        homeTypes,
        priceTier: "unknown",
        status: "unverified",
        evidenceQuality: {
          officialLicenceRecord: true,
          businessIdentityMatched: Boolean(row.abn || row.acn),
          websiteEnriched: false,
        },
        sourceIds: [row.sourceId],
        addresses: row.address ? [row.address] : [],
        lastEnrichedAt: undefined,
      });
    } else {
      existing.states = unique([...existing.states, row.state]);
      existing.serviceRegions = unique([...existing.serviceRegions, ...serviceRegions]);
      existing.homeTypes = unique([...existing.homeTypes, ...homeTypes]);
      existing.sourceIds = unique([...existing.sourceIds, row.sourceId]);
      existing.addresses = unique([...existing.addresses, row.address].filter(Boolean));
      existing.abn ??= row.abn;
      existing.acn ??= row.acn;
      existing.evidenceQuality.businessIdentityMatched ||= Boolean(row.abn || row.acn);
    }

    builderLicences.push({
      id: `licence:${row.source}:${row.licenceNumber}:${hashPart(row.licenceClass)}`,
      builderId,
      source: row.source ?? LICENCE_SOURCES_BY_STATE[row.state],
      sourceId: row.sourceId,
      state: row.state,
      licenceNumber: row.licenceNumber,
      licenceClass: row.licenceClass,
      licenceType: row.licenceType,
      status: row.status,
      restrictions: Array.isArray(row.restrictions) ? row.restrictions : [],
      firstNominatedSupervisor: row.firstNominatedSupervisor,
      formerRegistrationNumber: row.formerRegistrationNumber,
      rawSourceUrl: row.sourceUrl,
      lastCheckedAt: row.lastCheckedAt,
      confidence: row.confidence,
      address: row.address,
      postcode: row.postcode,
      issueDate: row.issueDate,
      expiryDate: row.expiryDate,
      financialCategory: row.financialCategory,
      licenceGrade: row.licenceGrade,
    });
  }

  return {
    builders: [...builders.values()].sort((a, b) => a.name.localeCompare(b.name)),
    builderLicences: dedupeById(builderLicences),
  };
}

export function buildBuilderMemoryCards(builders, builderLicences, generatedAt = Date.now()) {
  const licencesByBuilder = new Map();
  for (const licence of builderLicences) {
    const licences = licencesByBuilder.get(licence.builderId) ?? [];
    licences.push(licence);
    licencesByBuilder.set(licence.builderId, licences);
  }

  return builders.map((builder) => {
    const licences = (licencesByBuilder.get(builder.id) ?? []).sort((a, b) =>
      `${a.state}:${a.licenceNumber}:${a.licenceClass ?? ""}`.localeCompare(
        `${b.state}:${b.licenceNumber}:${b.licenceClass ?? ""}`
      )
    );
    const confidenceValues = licences.map((licence) => licence.confidence).filter((value) => typeof value === "number");
    const confidence = confidenceValues.length
      ? Number((confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length).toFixed(2))
      : 0;
    const unknowns = [];
    if (!builder.websiteUrl) unknowns.push("website not recorded");
    if (!builder.abn) unknowns.push("ABN not recorded");
    if (!builder.serviceRegions?.length) unknowns.push("service regions not recorded beyond licence evidence");
    unknowns.push("website, pricing, capacity and quote behaviour not enriched");

    return {
      id: `memory-card:${builder.id}`,
      builderId: builder.id,
      markdown: renderBuilderMemoryMarkdown({ builder, licences, unknowns, confidence, generatedAt }),
      searchableText: [
        builder.name,
        ...(builder.tradingNames ?? []),
        ...(builder.states ?? []),
        ...(builder.serviceRegions ?? []),
        ...(builder.homeTypes ?? []),
        builder.builderType,
        builder.priceTier,
        ...licences.map((licence) => `${licence.state} ${licence.source} ${licence.licenceNumber} ${licence.licenceClass ?? ""} ${licence.licenceType ?? ""} ${licence.status ?? ""}`),
      ]
        .filter(Boolean)
        .join(" "),
      sourceIds: licences.map((licence) => licence.id).filter(Boolean),
      lastGeneratedAt: generatedAt,
      confidence,
      ragNamespace: "builders",
      evidenceQuality: {
        officialLicenceRecord: licences.length > 0,
        businessIdentityMatched: Boolean(builder.abn || builder.acn),
        websiteEnriched: false,
      },
    };
  });
}

export function buildBuilderSearchIndex(builders, builderLicences, memoryCards) {
  const licencesByBuilder = groupBy(builderLicences, (licence) => licence.builderId);
  const memoryCardByBuilder = new Map(memoryCards.map((card) => [card.builderId, card]));

  return builders.map((builder) => {
    const licences = licencesByBuilder.get(builder.id) ?? [];
    const sources = unique(licences.map((licence) => licence.source));
    const licenceClasses = unique(licences.map((licence) => licence.licenceClass));
    const licenceTypes = unique(licences.map((licence) => licence.licenceType));
    const statuses = unique(licences.map((licence) => licence.status));
    const postcodes = unique([
      ...(builder.serviceRegions ?? []),
      ...licences.map((licence) => licence.postcode),
    ]);
    const confidenceValues = licences.map((licence) => licence.confidence).filter((value) => typeof value === "number");
    const confidence = confidenceValues.length
      ? Number((confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length).toFixed(2))
      : 0;

    return {
      builderId: builder.id,
      name: builder.name,
      tradingNames: builder.tradingNames ?? [],
      states: builder.states ?? [],
      postcodes,
      sourceIds: builder.sourceIds ?? [],
      sources,
      licenceNumbers: unique(licences.map((licence) => licence.licenceNumber)),
      licenceClasses,
      licenceTypes,
      statuses,
      builderType: builder.builderType ?? "unknown",
      homeTypes: builder.homeTypes ?? [],
      priceTier: builder.priceTier ?? "unknown",
      websiteUrl: builder.websiteUrl,
      abn: builder.abn,
      acn: builder.acn,
      evidenceQuality: {
        officialLicenceRecord: licences.length > 0,
        businessIdentityMatched: Boolean(builder.abn || builder.acn),
        websiteEnriched: false,
      },
      confidence,
      memoryCardId: memoryCardByBuilder.get(builder.id)?.id,
      searchableText: [
        builder.name,
        ...(builder.tradingNames ?? []),
        ...(builder.states ?? []),
        ...postcodes,
        ...sources,
        ...licenceClasses,
        ...licenceTypes,
        ...statuses,
        ...(builder.homeTypes ?? []),
        builder.abn,
        builder.acn,
      ]
        .filter(Boolean)
        .join(" "),
    };
  });
}

export function buildBuilderDuplicateReviewQueue(builders, builderLicences) {
  const licencesByBuilder = groupBy(builderLicences, (licence) => licence.builderId);
  const groups = new Map();

  for (const builder of builders) {
    const key = normalizeText(builder.name);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(builder);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([normalizedName, group]) => {
      const states = unique(group.flatMap((builder) => builder.states ?? [])).sort();
      const licences = group.flatMap((builder) => licencesByBuilder.get(builder.id) ?? []);
      const hasSharedBusinessNumber = hasRepeatedValue(group.map((builder) => builder.abn)) || hasRepeatedValue(group.map((builder) => builder.acn));

      return {
        id: `duplicate-review:${hashPart(normalizedName)}`,
        normalizedName,
        displayNames: unique(group.map((builder) => builder.name)).sort(),
        reviewReason: states.length > 1 ? "same_normalized_name_across_states" : "same_normalized_name_within_state",
        reviewOnly: true,
        autoMerge: false,
        confidence: hasSharedBusinessNumber ? "strong_review_candidate" : "name_only_review_candidate",
        builderCount: group.length,
        states,
        builderIds: group.map((builder) => builder.id).sort(),
        sourceIds: unique(group.flatMap((builder) => builder.sourceIds ?? [])).sort(),
        businessNumbers: {
          abns: unique(group.map((builder) => builder.abn)).sort(),
          acns: unique(group.map((builder) => builder.acn)).sort(),
        },
        licences: licences
          .map((licence) => ({
            builderId: licence.builderId,
            state: licence.state,
            source: licence.source,
            licenceNumber: licence.licenceNumber,
            licenceClass: licence.licenceClass,
            status: licence.status,
          }))
          .sort((a, b) => `${a.state}:${a.licenceNumber}`.localeCompare(`${b.state}:${b.licenceNumber}`)),
        notes: [
          "Same public names are not proof that records belong to the same business.",
          "Review against ABN/ACN, official register detail and website evidence before merging.",
        ],
      };
    })
    .sort((a, b) => b.builderCount - a.builderCount || a.normalizedName.localeCompare(b.normalizedName));
}

export function buildBuilderSourceAccessReport({ sources = Object.values(BUILDER_DATA_SOURCES), sourceStats = [], generatedAt = Date.now() } = {}) {
  const importedSourceIds = new Set(sourceStats.map((stat) => stat.sourceId));
  const importedStates = unique(sourceStats.map((stat) => stat.state)).sort();
  const pendingSources = sources.filter((source) => !importedSourceIds.has(source.id));
  const accessEvidence = sources.flatMap((source) =>
    (source.accessEvidence ?? []).map((evidence) => ({
      state: source.state,
      sourceId: source.id,
      sourceName: source.name,
      ...evidence,
    }))
  );

  return {
    schemaVersion: 1,
    generatedAt: new Date(generatedAt).toISOString(),
    importedStates,
    pendingStates: unique(pendingSources.map((source) => source.state)).sort(),
    importedSources: sourceStats.map((stat) => ({
      state: stat.state,
      sourceId: stat.sourceId,
      rawRowsRead: stat.rawRowsRead,
      builderRowsAccepted: stat.builderRowsAccepted,
      totalAvailable: stat.totalAvailable,
      complete: stat.complete,
      url: stat.url,
    })),
    pendingSources: pendingSources.map((source) => ({
      state: source.state,
      sourceId: source.id,
      sourceName: source.name,
      sourceType: source.type,
      url: source.url,
      searchUrl: source.searchUrl,
      accessStatus: source.accessStatus ?? "connector_not_run",
      notes: source.notes,
      evidence: source.accessEvidence ?? [],
    })),
    rejectedCandidates: accessEvidence.filter((evidence) => evidence.importDecision?.startsWith("rejected_")),
    limitations: [
      "This report records source-access decisions for the builder import pipeline; it is not a substitute for imported licence evidence.",
      "Pending sources remain excluded from builder records until a production-safe official extract, documented API or sanctioned access path is available.",
      "Historical snapshots and aggregate-only annual report tables are not imported as current builder list evidence.",
    ],
  };
}

export function summarizeBuilderImport({ sourceStats, builders, builderLicences, startedAt, finishedAt }) {
  const byState = {};
  for (const builder of builders) {
    for (const state of builder.states) {
      byState[state] ??= { builders: 0, licences: 0 };
      byState[state].builders += 1;
    }
  }
  for (const licence of builderLicences) {
    byState[licence.state] ??= { builders: 0, licences: 0 };
    byState[licence.state].licences += 1;
  }
  const importedStates = sourceStats.map((stat) => stat.state).filter(Boolean);
  const pendingStates = ["QLD", "NSW", "VIC", "WA", "SA", "ACT", "TAS", "NT"].filter(
    (state) => !importedStates.includes(state)
  );
  const pendingAccessDetails = Object.values(BUILDER_DATA_SOURCES)
    .filter((source) => pendingStates.includes(source.state) && source.accessStatus)
    .map((source) => `${source.state}: ${source.accessStatus}`);
  return {
    startedAt,
    finishedAt,
    sourceStats,
    totals: {
      builders: builders.length,
      licences: builderLicences.length,
    },
    byState,
    limitations: [
      `${formatStateList(importedStates)} ${importedStates.length === 1 ? "is" : "are"} imported from official public extracts in this pipeline.`,
      `${formatStateList(pendingStates)} ${pendingStates.length === 1 ? "source connector is" : "source connectors are"} not included in this import run.`,
      pendingAccessDetails.length ? `Pending source access notes: ${pendingAccessDetails.join("; ")}.` : undefined,
      "Website, ABN and association enrichment are not assumed unless present in imported official rows or later enrichment jobs.",
      "Records are licence evidence for builder suitability, not a guarantee of safety, quality, availability or insurance.",
    ].filter(Boolean),
  };
}

export function summarizeBuilderDataQuality({ sourceStats, builders, builderLicences, memoryCards, generatedAt = Date.now() }) {
  const importedStates = sourceStats.map((stat) => stat.state).filter(Boolean);
  const pendingSources = Object.values(BUILDER_DATA_SOURCES)
    .filter((source) => !importedStates.includes(source.state))
    .map((source) => ({
      state: source.state,
      sourceId: source.id,
      accessStatus: source.accessStatus ?? "connector_not_implemented",
      url: source.url,
      searchUrl: source.searchUrl,
    }));
  const builderNameGroups = groupBy(builders, (builder) => `${(builder.states ?? []).join("|")}:${normalizeText(builder.name)}`);
  const repeatedNameGroups = [...builderNameGroups.entries()]
    .filter(([, group]) => group.length > 1)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  const crossStateNameGroups = groupBy(builders, (builder) => normalizeText(builder.name));
  const repeatedCrossStateNames = [...crossStateNameGroups.entries()]
    .filter(([, group]) => new Set(group.flatMap((builder) => builder.states ?? [])).size > 1)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

  return {
    schemaVersion: 1,
    generatedAt: new Date(generatedAt).toISOString(),
    totals: {
      builders: builders.length,
      licences: builderLicences.length,
      memoryCards: memoryCards.length,
      importedStates: importedStates.length,
      pendingStates: pendingSources.length,
    },
    sourceAcceptanceRates: sourceStats.map((stat) => ({
      sourceId: stat.sourceId,
      state: stat.state,
      rawRowsRead: stat.rawRowsRead,
      builderRowsAccepted: stat.builderRowsAccepted,
      acceptanceRate: ratio(stat.builderRowsAccepted, stat.rawRowsRead),
      complete: stat.complete,
    })),
    builderFieldCoverage: {
      abn: coverage(builders, (builder) => builder.abn),
      acn: coverage(builders, (builder) => builder.acn),
      websiteUrl: coverage(builders, (builder) => builder.websiteUrl),
      serviceRegions: coverage(builders, (builder) => builder.serviceRegions?.length),
      addresses: coverage(builders, (builder) => builder.addresses?.length),
      multipleStates: coverage(builders, (builder) => (builder.states?.length ?? 0) > 1),
      officialLicenceRecord: coverage(builders, (builder) => builder.evidenceQuality?.officialLicenceRecord),
      businessIdentityMatched: coverage(builders, (builder) => builder.evidenceQuality?.businessIdentityMatched),
      websiteEnriched: coverage(builders, (builder) => builder.evidenceQuality?.websiteEnriched),
    },
    licenceFieldCoverage: {
      licenceClass: coverage(builderLicences, (licence) => licence.licenceClass),
      licenceType: coverage(builderLicences, (licence) => licence.licenceType),
      status: coverage(builderLicences, (licence) => licence.status),
      address: coverage(builderLicences, (licence) => licence.address),
      postcode: coverage(builderLicences, (licence) => licence.postcode),
      issueDate: coverage(builderLicences, (licence) => licence.issueDate),
      expiryDate: coverage(builderLicences, (licence) => licence.expiryDate),
      restrictions: coverage(builderLicences, (licence) => licence.restrictions?.length),
    },
    memoryCardCoverage: {
      cardsMatchBuilders: memoryCards.length === builders.length,
      ragNamespaceBuilders: coverage(memoryCards, (card) => card.ragNamespace === "builders"),
      sourceIds: coverage(memoryCards, (card) => card.sourceIds?.length),
      officialLicenceRecord: coverage(memoryCards, (card) => card.evidenceQuality?.officialLicenceRecord),
      websiteEnriched: coverage(memoryCards, (card) => card.evidenceQuality?.websiteEnriched),
    },
    duplicateSignals: {
      repeatedNameWithinStateGroups: repeatedNameGroups.length,
      repeatedNameWithinStateBuilderCount: repeatedNameGroups.reduce((sum, [, group]) => sum + group.length, 0),
      repeatedNameAcrossStateGroups: repeatedCrossStateNames.length,
      repeatedNameAcrossStateBuilderCount: repeatedCrossStateNames.reduce((sum, [, group]) => sum + group.length, 0),
      samples: repeatedNameGroups.slice(0, 10).map(([key, group]) => ({
        key,
        count: group.length,
        builderIds: group.slice(0, 5).map((builder) => builder.id),
      })),
    },
    pendingSources,
    limitations: [
      "Quality metrics are computed from imported official licence evidence only.",
      "Duplicate-name signals are review queues, not automatic duplicate matches.",
      "Website, pricing, capacity, ABN and quote-behaviour gaps remain unknown until evidence-backed enrichment jobs run.",
    ],
  };
}

function formatStateList(states) {
  if (!states.length) return "No states";
  if (states.length === 1) return states[0];
  if (states.length === 2) return `${states[0]} and ${states[1]}`;
  return `${states.slice(0, -1).join(", ")} and ${states.at(-1)}`;
}

function splitClasses(value) {
  return String(value ?? "")
    .split(";")
    .map(normalizeWhitespace)
    .filter(Boolean);
}

function inferHomeTypes(licenceClass) {
  const text = normalizeText(licenceClass);
  const types = [];
  if (text.includes("builder")) types.push("builder");
  return types.length ? types : ["unknown"];
}

function makeBuilderKey(row) {
  return [
    normalizeState(row.state),
    normalizeText(row.licenceNumber).replace(/[^a-z0-9]/g, ""),
    normalizeText(row.name).replace(/[^a-z0-9]/g, ""),
  ].join(":");
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function hasRepeatedValue(items) {
  const counts = new Map();
  for (const item of items.filter(Boolean)) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return [...counts.values()].some((count) => count > 1);
}

function coverage(items, predicate) {
  const count = items.filter((item) => Boolean(predicate(item))).length;
  return {
    count,
    total: items.length,
    ratio: ratio(count, items.length),
  };
}

function ratio(count, total) {
  return total ? Number((count / total).toFixed(4)) : 0;
}

function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

function dedupeById(items) {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function renderBuilderMemoryMarkdown({ builder, licences, unknowns, confidence, generatedAt }) {
  const licenceLines = licences.length
    ? licences.map((licence) => {
      const checked = licence.lastCheckedAt ? new Date(licence.lastCheckedAt).toISOString().slice(0, 10) : "check date unknown";
      const classText = licence.licenceClass ? `, ${licence.licenceClass}` : "";
      const statusText = licence.status ? `, ${licence.status}` : "";
      return `- ${licence.state} ${licence.source} ${licence.licenceNumber}${classText}${statusText}, checked ${checked}`;
    })
    : ["- No licence evidence recorded"];

  return `# Builder Memory Card

Builder: ${builder.name}
States: ${builder.states?.join(", ") || "unknown"}
Regions: ${builder.serviceRegions?.join(", ") || "unknown"}
Website: ${builder.websiteUrl ?? "unknown"}
ABN: ${builder.abn ?? "unknown"}
Builder type: ${builder.builderType ?? "unknown"}
Likely price tier: ${builder.priceTier ?? "unknown"}
Licence evidence:
${licenceLines.join("\n")}
Known limitations:
${unknowns.map((item) => `- ${item}`).join("\n")}
Last refreshed: ${new Date(generatedAt).toISOString().slice(0, 10)}
Confidence: ${confidence}
`;
}

function hashPart(value) {
  let hash = 0;
  for (const char of String(value ?? "")) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash.toString(36);
}

function toIsoDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const normalized = normalizeWhitespace(value);
  return normalized || undefined;
}

function parseAuDate(value) {
  const text = normalizeWhitespace(value);
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return text || undefined;
  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function firstRegistrationStart(periods) {
  const dates = registrationPeriodDates(periods);
  return dates[0]?.start;
}

function lastRegistrationEnd(periods) {
  const dates = registrationPeriodDates(periods);
  return dates.at(-1)?.end;
}

function registrationPeriodDates(periods) {
  return [...String(periods ?? "").matchAll(/(\d{1,2}\/\d{1,2}\/\d{4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{4})/g)]
    .map((match) => ({
      start: parseAuDate(match[1]),
      end: parseAuDate(match[2]),
    }));
}

function isExpired(value, now) {
  if (!(value instanceof Date)) return false;
  return value.getTime() < Number(now);
}
