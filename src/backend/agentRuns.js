import { BackendError, assertRequired } from "./errors.js";
import { requireEntity } from "./utils.js";
import { DWELLA_REALTIME_INSTRUCTIONS } from "../../convex/dwellaConversationContract.js";

export const DURABLE_AGENT_REQUIREMENTS = {
  runtime: "Eve durable agent runtime",
  execution: "Eve server-side async tool loop with persisted checkpoints",
  voice: "Eve voice route minting OpenAI Realtime gpt-realtime-2 sessions",
  approval: "human approval before external contact or private document sharing",
  screenControl: "persisted screen commands consumed by the browser shell",
};

export const AGENT_WORKSPACE_TOOLS = [
  "show_artifact",
  "append_to_document",
  "replace_document",
  "create_document",
  "export_document",
  "create_file",
  "create_folder",
  "set_browser_url",
  "add_map_marker",
];

const REALTIME_WORKSPACE_INSTRUCTIONS = [
  DWELLA_REALTIME_INSTRUCTIONS,
  `Available workspace controls: ${AGENT_WORKSPACE_TOOLS.join(", ")}.`,
].join("\n\n");

export function createAgentRunsService(repo, backend) {
  function createThread({ userId, projectId } = {}) {
    assertRequired(userId, "userId");
    const project = projectId ? requireEntity(repo.get("projects", projectId), "projects", projectId) : backend.projects.createOrResume(userId);
    const existing = repo
      .list("agentThreads", (thread) => thread.userId === userId && thread.projectId === project.id && thread.status === "active")
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];

    if (existing) return existing;

    return repo.insert("agentThreads", {
      userId,
      projectId: project.id,
      status: "active",
      durableRuntime: DURABLE_AGENT_REQUIREMENTS.runtime,
      voiceModel: "gpt-realtime-2",
    });
  }

  async function startTextRun(threadId, input, integrations = {}) {
    const message = normalizeMessage(input);
    const thread = requireEntity(repo.get("agentThreads", threadId), "agentThreads", threadId);
    const project = requireEntity(repo.get("projects", thread.projectId), "projects", thread.projectId);

    repo.insert("agentMessages", {
      threadId,
      role: "user",
      content: message,
      channel: "text",
    });

    const run = repo.insert("agentRuns", {
      threadId,
      projectId: project.id,
      status: "queued",
      channel: "text",
      input: message,
      model: integrations.model ?? null,
      durable: true,
    });

    if (typeof integrations.startDurableRun !== "function") {
      repo.insert("screenCommands", {
        threadId,
        runId: run.id,
        type: "show_status",
        target: "conversation",
        payload: { status: "error", reason: "durable_runtime_missing" },
        status: "pending",
      });
      return repo.patch("agentRuns", run.id, {
        status: "error",
        error: missingRuntimeError(),
      });
    }

    const result = await integrations.startDurableRun({
      thread,
      project,
      run,
      message,
      tools: createAgentToolHandlers(thread, project),
      requirements: DURABLE_AGENT_REQUIREMENTS,
    });

    if (!result || typeof result !== "object") {
      throw new BackendError("integration.invalid_response", "startDurableRun must return a durable run result object");
    }

    for (const event of result.events ?? []) {
      repo.insert("agentEvents", { threadId, runId: run.id, ...event });
    }
    for (const command of result.screenCommands ?? []) {
      repo.insert("screenCommands", {
        threadId,
        runId: run.id,
        status: "pending",
        ...command,
      });
    }
    if (result.assistantMessage) {
      repo.insert("agentMessages", {
        threadId,
        runId: run.id,
        role: "assistant",
        content: result.assistantMessage,
        channel: "text",
      });
    }

    return repo.patch("agentRuns", run.id, {
      status: result.status ?? "running",
      durableRunId: result.durableRunId,
      nextStep: result.nextStep,
    });
  }

  async function createRealtimeVoiceSession(threadId, integrations = {}) {
    const thread = requireEntity(repo.get("agentThreads", threadId), "agentThreads", threadId);
    if (typeof integrations.createRealtimeSession !== "function") {
      return {
        status: "error",
        model: "gpt-realtime-2",
        error: {
          provider: "OpenAI Realtime",
          model: "gpt-realtime-2",
          reason: "createRealtimeSession integration is not configured server-side",
        },
      };
    }

    const session = await integrations.createRealtimeSession({
      thread,
      model: "gpt-realtime-2",
      instructions: REALTIME_WORKSPACE_INSTRUCTIONS,
      workspaceTools: AGENT_WORKSPACE_TOOLS,
    });

    if (!session?.clientSecret) {
      throw new BackendError("integration.invalid_response", "Realtime session must return an ephemeral clientSecret");
    }

    repo.insert("agentEvents", {
      threadId,
      type: "voice_session_created",
      payload: { model: "gpt-realtime-2" },
    });

    return { status: "ready", model: "gpt-realtime-2", ...session };
  }

  function getThreadState(threadId) {
    const thread = requireEntity(repo.get("agentThreads", threadId), "agentThreads", threadId);
    return {
      thread,
      project: repo.get("projects", thread.projectId),
      messages: repo.list("agentMessages", (message) => message.threadId === threadId),
      runs: repo.list("agentRuns", (run) => run.threadId === threadId),
      events: repo.list("agentEvents", (event) => event.threadId === threadId),
      screenCommands: repo.list("screenCommands", (command) => command.threadId === threadId),
    };
  }

  function markScreenCommandApplied(commandId) {
    requireEntity(repo.get("screenCommands", commandId), "screenCommands", commandId);
    return repo.patch("screenCommands", commandId, { status: "applied", appliedAt: Date.now() });
  }

  function createAgentToolHandlers(thread, project) {
    return {
      getProjectSnapshot: () => backend.projects.getSnapshot(project.id),
      updateProjectFacts: (facts) => backend.projects.updateFacts(project.id, facts),
      generateBuilderBrief: () => backend.briefs.createDraft(project.id),
      searchBuilders: (search) => backend.builders.searchMemory(search),
      compareQuotes: () => backend.quotes.compare(project.id),
      requestOutreachApproval: ({ builderId }) => {
        const draft = backend.outreach.draftBuilderEmail(project.id, builderId);
        return backend.outreach.requestUserApproval(project.id, draft.payload);
      },
      controlWorkspace: (command) =>
        repo.insert("screenCommands", {
          threadId: thread.id,
          type: command.type,
          target: command.target,
          payload: command.payload ?? {},
          status: "pending",
        }),
    };
  }

  return { createThread, startTextRun, createRealtimeVoiceSession, getThreadState, markScreenCommandApplied };
}

function normalizeMessage(input) {
  const message = typeof input === "string" ? input.trim() : String(input?.message ?? "").trim();
  assertRequired(message, "message");
  return message;
}

function missingRuntimeError() {
  return {
    runtime: DURABLE_AGENT_REQUIREMENTS.runtime,
    voice: DURABLE_AGENT_REQUIREMENTS.voice,
    reason: "No server-side durable runner is configured for this environment.",
    requiredEnvironment: ["OPENAI_API_KEY", "VITE_DWELLA_EVE_URL"],
  };
}
