import { assertRequired } from "./errors.js";
import { formatDate, requireEntity } from "./utils.js";

const MISSING = "To confirm";

function value(facts, key) {
  const item = facts[key];
  if (Array.isArray(item)) return item.length ? item.join("\n- ") : MISSING;
  return item === undefined || item === null || item === "" ? MISSING : String(item);
}

function bulletList(items) {
  return Array.isArray(items) && items.length ? items.map((item) => `- ${item}`).join("\n") : `- ${MISSING}`;
}

function documentRows(documents) {
  const known = new Map(documents.map((doc) => [doc.type, doc]));
  return ["Land contract", "Disclosure plan", "Survey", "Soil report", "Architectural plans", "Engineering", "Inclusions schedule"]
    .map((type) => {
      const doc = known.get(type);
      return `| ${type} | ${doc?.status ?? MISSING} | ${doc?.notes ?? MISSING} |`;
    })
    .join("\n");
}

export function createBriefsService(repo) {
  function createDraft(projectId) {
    const project = requireEntity(repo.get("projects", projectId), "projects", projectId);
    const markdown = renderBuilderBrief(project, repo.list("documents", (document) => document.projectId === projectId));
    return repo.insert("briefs", {
      projectId,
      markdown,
      status: "draft",
      version: repo.list("briefs", (brief) => brief.projectId === projectId).length + 1,
    });
  }

  function updateMarkdown(projectId, markdown) {
    assertRequired(markdown, "markdown");
    const current = getCurrent(projectId);
    if (!current) {
      return repo.insert("briefs", { projectId, markdown, status: "draft", version: 1 });
    }
    return repo.patch("briefs", current.id, { markdown, status: "draft" });
  }

  function getCurrent(projectId) {
    requireEntity(repo.get("projects", projectId), "projects", projectId);
    return repo.list("briefs", (brief) => brief.projectId === projectId).sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
  }

  function markReadyForApproval(projectId) {
    const current = requireEntity(getCurrent(projectId), "briefs", `project:${projectId}`);
    return repo.patch("briefs", current.id, { status: "ready_for_approval" });
  }

  function exportPdf(projectId) {
    const current = requireEntity(getCurrent(projectId), "briefs", `project:${projectId}`);
    return {
      status: "requires_renderer",
      briefId: current.id,
      markdown: current.markdown,
      message: "PDF rendering should be performed by the configured document renderer in the deployment environment.",
    };
  }

  return { createDraft, updateMarkdown, getCurrent, markReadyForApproval, exportPdf };
}

export function renderBuilderBrief(project, documents = []) {
  const facts = project.facts ?? {};
  const date = formatDate(Date.now(), "Australia/Sydney");
  const priorities = bulletList(facts.priorities);
  const concerns = bulletList(facts.concerns);
  const keySpaces = bulletList(facts.keySpaces);
  const mustHaves = bulletList(facts.mustHaves);
  const niceToHaves = bulletList(facts.niceToHaves);
  const attachmentList = documents.length
    ? documents.map((document) => `- ${document.name} (${document.status ?? "uploaded"})`).join("\n")
    : `- ${MISSING}`;

  return `# Builder Brief: ${value(facts, "projectName")}

Prepared by Dwella for ${value(facts, "homeownerName")}  
Date: ${date}  
Project location: ${value(facts, "suburb")}, ${value(facts, "state")}  
Tender response requested by: ${value(facts, "responseDeadline")}

---

## 1. Project Summary

${value(facts, "oneParagraphSummary")}

Project type: ${value(facts, "projectType")}  
Current stage: ${value(facts, "currentStage")}  
Target budget: ${value(facts, "budgetRange")}  
Target start: ${value(facts, "targetStartDate")}  
Preferred contract approach: ${value(facts, "contractApproach")}

---

## 2. Homeowner Priorities

The homeowner is looking for:

${priorities}

Important concerns:

${concerns}

---

## 3. Site Information

Address / suburb: ${value(facts, "siteLocation")}  
Lot / plan details: ${value(facts, "lotPlanDetails")}  
Land status: ${value(facts, "landStatus")}  
Site access notes: ${value(facts, "siteAccess")}  
Known site conditions: ${value(facts, "siteConditions")}  
Known overlays or constraints: ${value(facts, "planningConstraints")}

Documents provided:

| Document | Status | Notes |
|---|---|---|
${documentRows(documents)}

---

## 4. Desired Home

Bedrooms: ${value(facts, "bedrooms")}  
Bathrooms: ${value(facts, "bathrooms")}  
Car spaces: ${value(facts, "carSpaces")}  
Storeys: ${value(facts, "storeys")}  
Approximate size: ${value(facts, "homeSize")}  
Preferred style: ${value(facts, "style")}  

Key spaces:

${keySpaces}

Must-haves:

${mustHaves}

Nice-to-haves:

${niceToHaves}

---

## 5. Scope to Quote

Please provide a quote that clearly addresses:

### Design and approvals

- Design responsibility
- Planning / building approval assumptions
- Engineering assumptions
- Certifier involvement
- Energy efficiency / NCC assumptions

### Site works

- Earthworks
- Excavation
- Rock removal
- Piering / slab upgrade assumptions
- Retaining walls
- Drainage and stormwater
- Temporary fencing and site establishment
- Crane or difficult-access allowance

### Construction

- Foundations and slab
- Frame
- Roof
- External cladding / brickwork
- Windows and glazing
- Insulation
- Internal linings
- Stairs, if applicable
- Waterproofing
- Painting

### Services

- Electrical
- Lighting
- Solar readiness
- Plumbing
- Hot water
- Heating and cooling
- Data / NBN
- Gas, if applicable

### Fixtures, fittings and finishes

- Kitchen
- Bathroom fittings
- Tapware
- Appliances
- Flooring
- Tiles
- Joinery
- Wardrobes
- Door hardware
- Window coverings

### External works

- Driveway
- Crossover
- Paths
- Landscaping
- Fencing
- Decking / alfresco
- Pools or future pool provisions, if applicable

---

## 6. Quote Format Requested

1. Total quoted price including GST
2. Itemised inclusions
3. Itemised exclusions
4. Prime Cost items with quantity, unit rate and allowance
5. Provisional Sums with quantity, unit rate, labour/material assumptions and builder margin
6. Site-cost assumptions
7. Quote validity period
8. Estimated build duration
9. Deposit and progress payment schedule
10. Any escalation clauses
11. Any owner-supplied item assumptions
12. Required next steps before contract

---

## 7. Questions for Builder

1. What soil classification, slab and piering assumptions have you allowed for?
2. Are excavation, rock removal and spoil removal included?
3. Are retaining walls included or excluded?
4. Are driveway, crossover and stormwater works included?
5. Which items are Prime Cost items?
6. Which items are Provisional Sums?
7. What is excluded that homeowners often assume is included?
8. What selections need to be finalised before a fixed price can be confirmed?
9. How long is the quote valid?
10. Who will be the main point of contact during pre-construction and construction?
11. Can you provide examples of similar completed projects?
12. Are you currently licensed and insured for this type of work in ${value(facts, "state")}?

---

## 8. Attachments

${attachmentList}

---

## 9. Dwella Notes

The homeowner is seeking comparable quotes from multiple suitable builders. Please make inclusions, exclusions, assumptions, Prime Cost items and Provisional Sums as clear as possible so the quote can be reviewed on a like-for-like basis.
`;
}
