import { assertRequired } from "./errors.js";
import { BRIEF_FACT_FIELDS } from "./policies.js";
import { mergeFacts, requireEntity } from "./utils.js";

export function createProjectsService(repo) {
  function createOrResume(userId) {
    assertRequired(userId, "userId");
    const existing = repo
      .list("projects", (project) => project.userId === userId && project.status !== "archived")
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];

    if (existing) return existing;

    return repo.insert("projects", {
      userId,
      status: "active",
      facts: {},
      nextStep: "Collect project location, land status, budget and desired home requirements.",
    });
  }

  function getSnapshot(projectId) {
    const project = requireEntity(repo.get("projects", projectId), "projects", projectId);
    const brief = repo.list("briefs", (item) => item.projectId === projectId).sort((a, b) => b.updatedAt - a.updatedAt)[0];
    const documents = repo.list("documents", (item) => item.projectId === projectId);
    const contactEvents = repo.list("builderContactEvents", (item) => item.projectId === projectId);
    const missingFacts = getMissingFacts(projectId);

    return {
      project,
      brief: brief ?? null,
      documentCount: documents.length,
      contactEventCount: contactEvents.length,
      missingFacts,
      nextStep: project.nextStep,
    };
  }

  function updateFacts(projectId, facts) {
    assertRequired(facts, "facts");
    const project = requireEntity(repo.get("projects", projectId), "projects", projectId);
    return repo.patch("projects", projectId, {
      facts: mergeFacts(project.facts ?? {}, facts),
    });
  }

  function getMissingFacts(projectId) {
    const project = requireEntity(repo.get("projects", projectId), "projects", projectId);
    const facts = project.facts ?? {};
    return BRIEF_FACT_FIELDS.filter((field) => {
      const value = facts[field];
      return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
    });
  }

  function setNextStep(projectId, nextStep) {
    assertRequired(nextStep, "nextStep");
    requireEntity(repo.get("projects", projectId), "projects", projectId);
    return repo.patch("projects", projectId, { nextStep });
  }

  return { createOrResume, getSnapshot, updateFacts, getMissingFacts, setNextStep };
}
