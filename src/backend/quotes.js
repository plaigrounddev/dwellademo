import { BackendError, assertRequired } from "./errors.js";
import { requireEntity } from "./utils.js";

const RISK_CHECKS = [
  ["totalPriceIncludingGst", "Total quoted price including GST is missing."],
  ["itemisedInclusions", "Itemised inclusions are missing."],
  ["itemisedExclusions", "Itemised exclusions are missing."],
  ["primeCostItems", "Prime Cost items are not clearly listed."],
  ["provisionalSums", "Provisional Sums are not clearly listed."],
  ["siteCostAssumptions", "Site-cost assumptions are missing."],
  ["quoteValidityPeriod", "Quote validity period is missing."],
  ["paymentSchedule", "Deposit and progress payment schedule is missing."],
];

export function createQuotesService(repo) {
  async function ingestDocument(projectId, documentId, integrations = {}) {
    requireEntity(repo.get("projects", projectId), "projects", projectId);
    const document = requireEntity(repo.get("documents", documentId), "documents", documentId);
    if (document.projectId !== projectId) {
      throw new BackendError("validation.project_mismatch", "Quote document does not belong to project");
    }
    if (typeof integrations.extractQuote !== "function") {
      throw new BackendError("integration.missing", "ingestDocument requires an extractQuote integration");
    }
    const extracted = await integrations.extractQuote(document);
    return repo.insert("quoteDocuments", {
      projectId,
      documentId,
      builderId: extracted.builderId,
      extracted,
      status: "ingested",
    });
  }

  function extractLineItems(quoteId) {
    const quote = requireEntity(repo.get("quoteDocuments", quoteId), "quoteDocuments", quoteId);
    const extracted = quote.extracted ?? {};
    return {
      quoteId,
      inclusions: extracted.itemisedInclusions ?? [],
      exclusions: extracted.itemisedExclusions ?? [],
      primeCostItems: extracted.primeCostItems ?? [],
      provisionalSums: extracted.provisionalSums ?? [],
      siteCostAssumptions: extracted.siteCostAssumptions ?? [],
    };
  }

  function compare(projectId) {
    requireEntity(repo.get("projects", projectId), "projects", projectId);
    const quotes = repo.list("quoteDocuments", (quote) => quote.projectId === projectId);
    return {
      projectId,
      quoteCount: quotes.length,
      quotes: quotes.map((quote) => ({
        quoteId: quote.id,
        builderId: quote.builderId ?? quote.extracted?.builderId ?? null,
        totalPriceIncludingGst: quote.extracted?.totalPriceIncludingGst ?? null,
        riskFlags: riskFlags(quote.extracted ?? {}),
      })),
      summary:
        quotes.length < 2
          ? "At least two quotes are needed for a like-for-like comparison."
          : "Compare headline price alongside inclusions, exclusions, Prime Cost items, Provisional Sums and site-cost assumptions.",
    };
  }

  function generateClarificationQuestions(projectId, quoteId) {
    requireEntity(repo.get("projects", projectId), "projects", projectId);
    const quote = requireEntity(repo.get("quoteDocuments", quoteId), "quoteDocuments", quoteId);
    if (quote.projectId !== projectId) {
      throw new BackendError("validation.project_mismatch", "Quote does not belong to project");
    }
    const flags = riskFlags(quote.extracted ?? {});
    return flags.map((flag) => `Please clarify: ${flag}`);
  }

  return { ingestDocument, extractLineItems, compare, generateClarificationQuestions };
}

function riskFlags(extracted) {
  const flags = [];
  for (const [field, message] of RISK_CHECKS) {
    const value = extracted[field];
    if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
      flags.push(message);
    }
  }
  if (Array.isArray(extracted.provisionalSums) && extracted.provisionalSums.length > 0) {
    flags.push("Review Provisional Sums carefully because final costs can move if assumptions change.");
  }
  return flags;
}
