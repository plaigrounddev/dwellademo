import { internalAction } from "./_generated/server";
import { v } from "convex/values";

const vArtifactTarget = v.union(
  v.literal("doc"),
  v.literal("map"),
  v.literal("browser"),
  v.literal("files"),
  v.literal("concepts")
);

export const showArtifact = internalAction({
  args: { target: vArtifactTarget },
  returns: v.any(),
  handler: async (_ctx, args) => {
    return commandResult(`Opened the ${args.target} workspace.`, [openArtifact(args.target, "durable_agent_tool")]);
  },
});

export const createDocument = internalAction({
  args: {
    title: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (_ctx, args) => {
    const title = cleanText(args.title, "Untitled document");
    const content = cleanText(args.content, "");
    return commandResult(`Created ${title}.`, [
      { type: "create_document", target: "doc", payload: { title, content } },
      openArtifact("doc", "create_document"),
    ]);
  },
});

export const appendToDocument = internalAction({
  args: { text: v.string() },
  returns: v.any(),
  handler: async (_ctx, args) => {
    return commandResult("Appended to the active document.", [
      { type: "append_to_document", target: "doc", payload: { text: args.text } },
      openArtifact("doc", "append_to_document"),
    ]);
  },
});

export const replaceDocument = internalAction({
  args: { text: v.string() },
  returns: v.any(),
  handler: async (_ctx, args) => {
    return commandResult("Replaced the active document.", [
      { type: "replace_document", target: "doc", payload: { text: args.text } },
      openArtifact("doc", "replace_document"),
    ]);
  },
});

export const exportDocument = internalAction({
  args: {
    title: v.string(),
    content: v.string(),
    format: v.union(v.literal("pdf"), v.literal("doc")),
  },
  returns: v.any(),
  handler: async (_ctx, args) => {
    return commandResult(`Prepared ${args.title} for ${args.format.toUpperCase()} export.`, [
      { type: "export_document", target: "files", payload: args },
      openArtifact("files", "export_document"),
    ]);
  },
});

export const createFile = internalAction({
  args: {
    name: v.string(),
    mimeType: v.optional(v.string()),
    size: v.optional(v.number()),
    source: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (_ctx, args) => {
    const name = cleanText(args.name, "Untitled file");
    return commandResult(`Created file ${name}.`, [
      {
        type: "create_file",
        target: "files",
        payload: {
          name,
          ...(cleanOptionalText(args.mimeType) ? { mimeType: cleanOptionalText(args.mimeType) } : {}),
          ...(Number.isFinite(args.size) ? { size: args.size } : {}),
          ...(cleanOptionalText(args.source) ? { source: cleanOptionalText(args.source) } : {}),
        },
      },
      openArtifact("files", "create_file"),
    ]);
  },
});

export const createFolder = internalAction({
  args: { name: v.string() },
  returns: v.any(),
  handler: async (_ctx, args) => {
    const name = cleanText(args.name, "New folder");
    return commandResult(`Created folder ${name}.`, [
      { type: "create_folder", target: "files", payload: { name } },
      openArtifact("files", "create_folder"),
    ]);
  },
});

export const setBrowserUrl = internalAction({
  args: { url: v.string() },
  returns: v.any(),
  handler: async (_ctx, args) => {
    const url = cleanText(args.url, "about:blank");
    return commandResult(`Set the browser to ${url}.`, [
      { type: "set_browser_url", target: "browser", payload: { url } },
      openArtifact("browser", "set_browser_url"),
    ]);
  },
});

export const addMapMarker = internalAction({
  args: {
    label: v.string(),
    lat: v.number(),
    lng: v.number(),
  },
  returns: v.any(),
  handler: async (_ctx, args) => {
    const marker = {
      id: `durable-marker-${Date.now().toString(36)}`,
      label: cleanText(args.label, "Marker"),
      lat: args.lat,
      lng: args.lng,
    };
    return commandResult(`Added ${marker.label} to the map.`, [
      { type: "add_map_marker", target: "map", payload: { marker } },
      openArtifact("map", "add_map_marker"),
    ]);
  },
});

export const createConceptVisuals = internalAction({
  args: {
    briefSummary: v.optional(v.string()),
    brief: v.optional(
      v.object({
        location: v.optional(v.string()),
        stateOrTerritory: v.optional(v.string()),
        landStatus: v.optional(v.string()),
        budget: v.optional(v.string()),
        household: v.optional(v.string()),
        mustHaves: v.optional(v.array(v.string())),
        avoid: v.optional(v.array(v.string())),
        notes: v.optional(v.string()),
      })
    ),
    concepts: v.array(
      v.object({
        name: v.string(),
        summary: v.string(),
        style: v.string(),
        storeys: v.number(),
        bedrooms: v.optional(v.number()),
        bathrooms: v.optional(v.number()),
        roofForm: v.optional(v.string()),
        materials: v.array(v.string()),
        keyIdea: v.optional(v.string()),
        rationale: v.optional(v.string()),
        riskFlags: v.optional(v.array(v.string())),
      })
    ),
  },
  returns: v.any(),
  handler: async (_ctx, args) => {
    const conceptCount = Math.min(args.concepts.length, 5);
    return commandResult(
      `Started rendering ${conceptCount} concept direction${conceptCount === 1 ? "" : "s"} in the concept gallery.`,
      [
        {
          type: "create_concepts",
          target: "concepts",
          payload: {
            briefSummary: args.briefSummary,
            brief: args.brief,
            concepts: args.concepts.slice(0, 5),
          },
        },
        openArtifact("concepts", "create_concept_visuals"),
      ]
    );
  },
});

export const showConceptInColor = internalAction({
  args: { conceptName: v.optional(v.string()) },
  returns: v.any(),
  handler: async (_ctx, args) => {
    const conceptName = cleanText(args.conceptName, "the latest concept");
    return commandResult(`Started colouring ${conceptName} in the concept gallery.`, [
      {
        type: "render_concept_color",
        target: "concepts",
        payload: { conceptName: cleanOptionalText(args.conceptName) ?? "" },
      },
      openArtifact("concepts", "show_concept_in_color"),
    ]);
  },
});

export const showConceptFloorPlan = internalAction({
  args: { conceptName: v.optional(v.string()) },
  returns: v.any(),
  handler: async (_ctx, args) => {
    const conceptName = cleanText(args.conceptName, "the latest concept");
    return commandResult(`Started drawing a concept floor plan for ${conceptName}.`, [
      {
        type: "render_concept_floor_plan",
        target: "concepts",
        payload: { conceptName: cleanOptionalText(args.conceptName) ?? "" },
      },
      openArtifact("concepts", "show_concept_floor_plan"),
    ]);
  },
});

export const showConceptView = internalAction({
  args: {
    conceptName: v.optional(v.string()),
    view: v.string(),
  },
  returns: v.any(),
  handler: async (_ctx, args) => {
    const conceptName = cleanText(args.conceptName, "the latest concept");
    return commandResult(`Started creating the ${cleanText(args.view, "requested view")} for ${conceptName}.`, [
      {
        type: "render_concept_view",
        target: "concepts",
        payload: {
          conceptName: cleanOptionalText(args.conceptName) ?? "",
          view: cleanText(args.view),
        },
      },
      openArtifact("concepts", "show_concept_view"),
    ]);
  },
});

export const focusMap = internalAction({
  args: {
    lat: v.number(),
    lng: v.number(),
    zoom: v.optional(v.number()),
    label: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (_ctx, args) => {
    const label = cleanOptionalText(args.label);
    return commandResult(`Moved the map to ${label ?? `${args.lat.toFixed(3)}, ${args.lng.toFixed(3)}`}.`, [
      {
        type: "focus_map",
        target: "map",
        payload: {
          lat: args.lat,
          lng: args.lng,
          zoom: args.zoom,
          ...(label ? { label } : {}),
        },
      },
      openArtifact("map", "focus_map"),
    ]);
  },
});

export const requestBuilderOutreachApproval = internalAction({
  args: {
    builderName: v.optional(v.string()),
    message: v.string(),
  },
  returns: v.any(),
  handler: async (_ctx, args) => {
    const builderName = cleanText(args.builderName, "the builder");
    return commandResult(`Approval is required before contacting ${builderName}.`, [
      {
        type: "show_status",
        target: "conversation",
        payload: {
          status: "approval_required",
          builderName,
          message: args.message,
        },
      },
    ]);
  },
});

function commandResult(summary, screenCommands) {
  return { summary, screenCommands };
}

function openArtifact(target, source) {
  return { type: "open_artifact", target, payload: { source } };
}

function cleanText(value, fallback) {
  const trimmed = String(value ?? "").trim();
  return trimmed || fallback;
}

function cleanOptionalText(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed || undefined;
}
