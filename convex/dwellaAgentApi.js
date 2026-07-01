import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { createActionTool, defineInternalAgentApi, streamHandlerAction } from "convex-durable-agents";
import { components, internal } from "./_generated/api";
import { env } from "./_generated/server";
import { DWELLA_AGENT_INSTRUCTIONS } from "./dwellaConversationContract.js";

const artifactTarget = z.enum(["doc", "map", "browser", "files"]);

export const chatAgentHandler = streamHandlerAction(components.durable_agents, async () => {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for the Dwella durable agent.");
  }

  const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
  return {
    model: openai.responses(env.OPENAI_TEXT_MODEL ?? "gpt-4.1-mini"),
    system: [
      DWELLA_AGENT_INSTRUCTIONS,
      "Use tools when the UI should change. Tool results are applied by the Dwella shell, so do not claim a document, file, browser URL, or map marker exists unless the matching tool was called.",
      "Use web_search whenever the user needs current, local, factual, location-specific, council, builder, pricing, regulation, or area information. Do not mention missing provider configuration. If live search cannot verify something, say naturally that you couldn't verify it live just now and keep assumptions clearly labelled.",
      "If an uploaded file summary says extraction was unavailable, say that plainly and ask for a text version or a supported extraction path before relying on its contents.",
    ].join("\n\n"),
    providerTools: {
      web_search: openai.tools.webSearch({
        searchContextSize: "medium",
        userLocation: {
          type: "approximate",
          country: "AU",
          timezone: "Australia/Sydney",
        },
      }),
    },
    tools: {
      show_artifact: createActionTool({
        description: "Show one workspace artifact panel in the right side of the app.",
        args: z.object({ target: artifactTarget }),
        handler: internal.dwellaAgentTools.showArtifact,
        retry: true,
      }),
      create_document: createActionTool({
        description: "Create a new rich document in the current agent thread. Use this for project plans, builder briefs, quote scopes, and detailed workspace drafts.",
        args: z.object({
          title: z.string().optional(),
          content: z.string().optional(),
        }),
        handler: internal.dwellaAgentTools.createDocument,
        retry: true,
      }),
      append_to_document: createActionTool({
        description: "Append text as rich document blocks to the active Dwella document.",
        args: z.object({ text: z.string() }),
        handler: internal.dwellaAgentTools.appendToDocument,
        retry: true,
      }),
      replace_document: createActionTool({
        description: "Replace the active rich document body with new text after the user clearly asks for a replacement or a complete redraft.",
        args: z.object({ text: z.string() }),
        handler: internal.dwellaAgentTools.replaceDocument,
        retry: true,
      }),
      export_document: createActionTool({
        description: "Export a document or builder brief as a user-downloadable PDF or DOC file.",
        args: z.object({
          title: z.string(),
          content: z.string(),
          format: z.enum(["pdf", "doc"]),
        }),
        handler: internal.dwellaAgentTools.exportDocument,
        retry: true,
      }),
      create_file: createActionTool({
        description: "Create a file entry in the current agent thread workspace.",
        args: z.object({
          name: z.string(),
          mimeType: z.string().optional(),
          size: z.number().optional(),
          source: z.string().optional(),
        }),
        handler: internal.dwellaAgentTools.createFile,
        retry: true,
      }),
      create_folder: createActionTool({
        description: "Create a folder in the current agent thread workspace.",
        args: z.object({ name: z.string() }),
        handler: internal.dwellaAgentTools.createFolder,
        retry: true,
      }),
      set_browser_url: createActionTool({
        description: "Set the sandbox browser address field.",
        args: z.object({ url: z.string() }),
        handler: internal.dwellaAgentTools.setBrowserUrl,
        retry: true,
      }),
      add_map_marker: createActionTool({
        description: "Add a marker to the live map when the user gives known coordinates.",
        args: z.object({
          label: z.string(),
          lat: z.number(),
          lng: z.number(),
        }),
        handler: internal.dwellaAgentTools.addMapMarker,
        retry: true,
      }),
      request_builder_outreach_approval: createActionTool({
        description: "Record that builder outreach needs explicit approval before any external contact.",
        args: z.object({
          builderName: z.string().optional(),
          message: z.string(),
        }),
        handler: internal.dwellaAgentTools.requestBuilderOutreachApproval,
        retry: true,
      }),
    },
    saveStreamDeltas: true,
    retry: {
      enabled: true,
      maxAttempts: 3,
    },
  };
});

export const {
  createThread,
  sendMessage,
  addMessage,
  getThread,
  listMessages,
  streamUpdates,
  listThreads,
  deleteThread,
  resumeThread,
  stopThread,
  addToolResult,
  addToolError,
} = defineInternalAgentApi(components.durable_agents, internal.dwellaAgentApi.chatAgentHandler);
