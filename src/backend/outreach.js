import { BackendError, assertKnown, assertRequired } from "./errors.js";
import { payloadHash, requireEntity } from "./utils.js";

export function createOutreachService(repo, buildersService) {
  function recordContactEvent(event) {
    assertRequired(event?.builderId, "event.builderId");
    assertRequired(event?.projectId, "event.projectId");
    assertKnown(event.type, ["drafted", "approved", "sent", "opened", "replied", "followed_up", "declined", "quote_received"], "event.type");
    assertKnown(event.channel, ["email", "phone", "form", "sms"], "event.channel");
    requireEntity(repo.get("projects", event.projectId), "projects", event.projectId);
    buildersService.getEvidencePack(event.builderId);
    return repo.insert("builderContactEvents", {
      ...event,
      localTimeZone: event.localTimeZone ?? buildersService.getContactPolicy(event.builderId).timezone,
      occurredAt: event.occurredAt ?? Date.now(),
    });
  }

  function draftBuilderEmail(projectId, builderId) {
    const project = requireEntity(repo.get("projects", projectId), "projects", projectId);
    const { builder } = buildersService.getEvidencePack(builderId);
    const brief = repo.list("briefs", (item) => item.projectId === projectId).sort((a, b) => b.updatedAt - a.updatedAt)[0];
    const facts = project.facts ?? {};
    const subject = `Builder quote request: ${facts.projectName ?? "Dwella project brief"}`;
    const body = [
      `Hello ${builder.name},`,
      "",
      "Dwella is preparing a builder-ready quote request for an Australian homeowner.",
      `Project location: ${facts.suburb ?? "To confirm"}, ${facts.state ?? "To confirm"}`,
      `Project type: ${facts.projectType ?? "To confirm"}`,
      `Target budget: ${facts.budgetRange ?? "To confirm"}`,
      "",
      "Please review the attached brief and respond with itemised inclusions, exclusions, Prime Cost items, Provisional Sums and site-cost assumptions.",
      "",
      "Nothing should be treated as legal, financial or building-code advice. The homeowner will review any quote before making decisions.",
      "",
      "Kind regards,",
      "Dwella",
    ].join("\n");

    return recordContactEvent({
      builderId,
      projectId,
      type: "drafted",
      channel: "email",
      localTimeZone: buildersService.getContactPolicy(builderId).timezone,
      occurredAt: Date.now(),
      summary: `Drafted email to ${builder.name}`,
      payloadHash: payloadHash({ subject, body, briefId: brief?.id }),
      payload: { subject, body, briefId: brief?.id ?? null },
    });
  }

  function requestUserApproval(projectId, payload) {
    assertRequired(payload, "payload");
    requireEntity(repo.get("projects", projectId), "projects", projectId);
    return repo.insert("approvals", {
      projectId,
      payload,
      status: "pending",
      requestedAt: Date.now(),
      payloadHash: payloadHash(payload),
    });
  }

  function approveRequest(approvalId, approvedBy) {
    assertRequired(approvedBy, "approvedBy");
    const approval = requireEntity(repo.get("approvals", approvalId), "approvals", approvalId);
    if (approval.status !== "pending") {
      throw new BackendError("approval.invalid_state", "Only pending approval requests can be approved");
    }
    return repo.patch("approvals", approvalId, { status: "approved", approvedBy, approvedAt: Date.now() });
  }

  async function sendApprovedBuilderEmail(approvalId, integrations = {}) {
    const approval = requireEntity(repo.get("approvals", approvalId), "approvals", approvalId);
    if (approval.status !== "approved") {
      throw new BackendError("approval.required", "Builder email cannot be sent until the user approves it");
    }
    if (typeof integrations.sendEmail !== "function") {
      throw new BackendError("integration.missing", "sendApprovedBuilderEmail requires a sendEmail integration");
    }
    const result = await integrations.sendEmail(approval.payload);
    return repo.patch("approvals", approvalId, { status: "sent", sentAt: Date.now(), sendResult: result });
  }

  function scheduleFollowUp(quoteRequestId) {
    assertRequired(quoteRequestId, "quoteRequestId");
    return repo.insert("followUps", {
      quoteRequestId,
      status: "scheduled",
      waitBusinessDays: 3,
      maxFollowUps: 2,
    });
  }

  function getContactHistory(builderId, projectId) {
    return repo
      .list("builderContactEvents", (event) => event.builderId === builderId && event.projectId === projectId)
      .sort((a, b) => a.occurredAt - b.occurredAt);
  }

  return { draftBuilderEmail, recordContactEvent, requestUserApproval, approveRequest, sendApprovedBuilderEmail, scheduleFollowUp, getContactHistory };
}
