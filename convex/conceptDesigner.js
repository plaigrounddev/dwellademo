import { action, env, internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const CONCEPT_DISCLAIMER =
  "Concept design only, for inspiration and early exploration. Not construction documentation, engineering, planning approval advice, or a substitute for a registered architect, building designer, certifier, or council assessment.";

const MAX_CONCEPTS = 5;
const IMAGE_TIMEOUT_MS = 180_000;

const vBriefInput = v.object({
  location: v.optional(v.string()),
  stateOrTerritory: v.optional(v.string()),
  landStatus: v.optional(v.string()),
  budget: v.optional(v.string()),
  household: v.optional(v.string()),
  mustHaves: v.optional(v.array(v.string())),
  avoid: v.optional(v.array(v.string())),
  notes: v.optional(v.string()),
});

const vConceptInput = v.object({
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
});

export const generateConceptPackage = action({
  args: {
    threadId: v.string(),
    briefSummary: v.optional(v.string()),
    brief: v.optional(vBriefInput),
    concepts: v.array(vConceptInput),
  },
  returns: v.union(v.id("agentConceptPackages"), v.null()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) {
      throw new Error("Not authenticated");
    }
    if (!env.OPENAI_API_KEY) {
      throw new Error("Concept rendering is not configured.");
    }

    const concepts = args.concepts.slice(0, MAX_CONCEPTS).map(cleanConcept).filter(Boolean);
    if (!concepts.length) return null;

    const created = await ctx.runMutation(internal.conceptDesigner.createPackageRows, {
      threadId: cleanText(args.threadId).slice(0, 160),
      ownerTokenIdentifier: identity.tokenIdentifier,
      briefSummary: cleanText(args.briefSummary, "Dream home concept directions").slice(0, 400),
      brief: cleanBrief(args.brief),
      concepts,
    });

    for (const optionId of created.optionIds) {
      await ctx.scheduler.runAfter(0, internal.conceptDesigner.renderConceptImages, { optionId });
    }
    return created.packageId;
  },
});

export const createPackageRows = internalMutation({
  args: {
    threadId: v.string(),
    ownerTokenIdentifier: v.string(),
    briefSummary: v.string(),
    brief: vBriefInput,
    concepts: v.array(vConceptInput),
  },
  returns: v.object({
    packageId: v.id("agentConceptPackages"),
    optionIds: v.array(v.id("agentConceptOptions")),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const packageId = await ctx.db.insert("agentConceptPackages", {
      threadId: args.threadId,
      ownerTokenIdentifier: args.ownerTokenIdentifier,
      briefSummary: args.briefSummary,
      brief: args.brief,
      createdAt: now,
      updatedAt: now,
    });

    const optionIds = [];
    for (let index = 0; index < args.concepts.length; index += 1) {
      const concept = args.concepts[index];
      optionIds.push(
        await ctx.db.insert("agentConceptOptions", {
          packageId,
          threadId: args.threadId,
          ownerTokenIdentifier: args.ownerTokenIdentifier,
          order: index,
          ...concept,
          status: "rendering",
          createdAt: now,
          updatedAt: now,
        })
      );
    }
    return { packageId, optionIds };
  },
});

export const renderConceptImages = internalAction({
  args: { optionId: v.id("agentConceptOptions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const option = await ctx.runQuery(internal.conceptDesigner.getOptionForRender, { optionId: args.optionId });
    if (!option) return null;

    // Sketch-first: the fast black-and-white presentation sketch is the primary visual.
    // The colour render is derived from it later, on request, so the two always match.
    const patch = { updatedAt: Date.now() };
    try {
      const sketch = await generateImage({ prompt: buildSketchPrompt(option), apiKey: env.OPENAI_API_KEY });
      patch.sketchImageId = await ctx.storage.store(sketch);
      patch.status = "ready";
    } catch (error) {
      patch.status = "failed";
      patch.error = "The concept sketch could not be rendered this time.";
      console.error("Dwella concept sketch failed", {
        optionId: String(args.optionId),
        error: error instanceof Error ? error.message : String(error),
      });
    }

    await ctx.runMutation(internal.conceptDesigner.updateOption, { optionId: args.optionId, patch });
    return null;
  },
});

export const renderConceptColor = action({
  args: {
    threadId: v.string(),
    optionId: v.optional(v.id("agentConceptOptions")),
    conceptName: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) {
      throw new Error("Not authenticated");
    }

    const optionId = await ctx.runMutation(internal.conceptDesigner.markOptionForColor, {
      threadId: cleanText(args.threadId).slice(0, 160),
      ownerTokenIdentifier: identity.tokenIdentifier,
      optionId: args.optionId,
      conceptName: cleanText(args.conceptName).slice(0, 160),
    });
    if (optionId) {
      await ctx.scheduler.runAfter(0, internal.conceptDesigner.renderColorImage, { optionId });
    }
    return null;
  },
});

export const markOptionForColor = internalMutation({
  args: {
    threadId: v.string(),
    ownerTokenIdentifier: v.string(),
    optionId: v.optional(v.id("agentConceptOptions")),
    conceptName: v.optional(v.string()),
  },
  returns: v.union(v.id("agentConceptOptions"), v.null()),
  handler: async (ctx, args) => {
    let option = null;
    if (args.optionId) {
      const candidate = await ctx.db.get(args.optionId);
      if (
        candidate &&
        candidate.ownerTokenIdentifier === args.ownerTokenIdentifier &&
        candidate.threadId === args.threadId
      ) {
        option = candidate;
      }
    } else {
      const options = await ctx.db
        .query("agentConceptOptions")
        .withIndex("by_ownerTokenIdentifier_and_threadId", (q) =>
          q.eq("ownerTokenIdentifier", args.ownerTokenIdentifier).eq("threadId", args.threadId)
        )
        .order("desc")
        .take(MAX_CONCEPTS * 2);
      const wanted = args.conceptName?.toLowerCase() ?? "";
      option =
        (wanted &&
          options.find(
            (candidate) =>
              candidate.name.toLowerCase().includes(wanted) || wanted.includes(candidate.name.toLowerCase())
          )) ||
        options[0] ||
        null;
    }

    if (!option || option.status !== "ready" || option.colorStatus === "rendering") return null;
    await ctx.db.patch(option._id, { colorStatus: "rendering", updatedAt: Date.now() });
    return option._id;
  },
});

export const renderColorImage = internalAction({
  args: { optionId: v.id("agentConceptOptions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const option = await ctx.runQuery(internal.conceptDesigner.getOptionForRender, { optionId: args.optionId });
    if (!option) return null;

    const patch = { updatedAt: Date.now() };
    try {
      let image;
      const sketchBlob = option.sketchImageId ? await ctx.storage.get(option.sketchImageId) : null;
      if (sketchBlob) {
        image = await colorizeImage({
          image: sketchBlob,
          prompt: buildColorizePrompt(option),
          apiKey: env.OPENAI_API_KEY,
        });
      } else {
        image = await generateImage({ prompt: buildHeroPrompt(option), apiKey: env.OPENAI_API_KEY });
      }
      patch.heroImageId = await ctx.storage.store(image);
      patch.colorStatus = "ready";
    } catch (error) {
      patch.colorStatus = "failed";
      console.error("Dwella concept colour render failed", {
        optionId: String(args.optionId),
        error: error instanceof Error ? error.message : String(error),
      });
    }

    await ctx.runMutation(internal.conceptDesigner.updateOption, { optionId: args.optionId, patch });
    return null;
  },
});

export const getOptionForRender = internalQuery({
  args: { optionId: v.id("agentConceptOptions") },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.optionId);
  },
});

export const updateOption = internalMutation({
  args: {
    optionId: v.id("agentConceptOptions"),
    patch: v.object({
      status: v.optional(v.union(v.literal("rendering"), v.literal("ready"), v.literal("failed"))),
      colorStatus: v.optional(v.union(v.literal("rendering"), v.literal("ready"), v.literal("failed"))),
      heroImageId: v.optional(v.id("_storage")),
      sketchImageId: v.optional(v.id("_storage")),
      error: v.optional(v.string()),
      updatedAt: v.number(),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const option = await ctx.db.get(args.optionId);
    if (option) await ctx.db.patch(args.optionId, args.patch);
    return null;
  },
});

export const listThreadConcepts = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) return null;

    const packages = await ctx.db
      .query("agentConceptPackages")
      .withIndex("by_ownerTokenIdentifier_and_threadId", (q) =>
        q.eq("ownerTokenIdentifier", identity.tokenIdentifier).eq("threadId", args.threadId)
      )
      .order("desc")
      .take(1);
    const conceptPackage = packages[0];
    if (!conceptPackage) return null;

    const options = await ctx.db
      .query("agentConceptOptions")
      .withIndex("by_packageId", (q) => q.eq("packageId", conceptPackage._id))
      .take(MAX_CONCEPTS + 1);

    const concepts = [];
    for (const option of options.sort((a, b) => a.order - b.order)) {
      concepts.push({
        id: option._id,
        name: option.name,
        summary: option.summary,
        style: option.style,
        storeys: option.storeys,
        bedrooms: option.bedrooms ?? null,
        bathrooms: option.bathrooms ?? null,
        roofForm: option.roofForm ?? "",
        materials: option.materials,
        keyIdea: option.keyIdea ?? "",
        rationale: option.rationale ?? "",
        riskFlags: option.riskFlags ?? [],
        status: option.status,
        colorStatus: option.colorStatus ?? null,
        error: option.error ?? "",
        heroImageUrl: option.heroImageId ? await ctx.storage.getUrl(option.heroImageId) : null,
        sketchImageUrl: option.sketchImageId ? await ctx.storage.getUrl(option.sketchImageId) : null,
      });
    }

    return {
      packageId: conceptPackage._id,
      briefSummary: conceptPackage.briefSummary,
      createdAt: conceptPackage.createdAt,
      disclaimer: CONCEPT_DISCLAIMER,
      concepts,
    };
  },
});

async function generateImage({ prompt, apiKey }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
  let response;
  try {
    response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.OPENAI_IMAGE_MODEL ?? "gpt-image-2",
        prompt,
        n: 1,
        size: "1536x1024",
        quality: "medium",
        output_format: "png",
      }),
    });
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error?.message ?? `Image generation failed with status ${response.status}.`);
  }
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("Image generation returned no image data.");
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: "image/png" });
}

async function colorizeImage({ image, prompt, apiKey }) {
  const form = new FormData();
  form.append("model", env.OPENAI_IMAGE_MODEL ?? "gpt-image-2");
  form.append("image", image, "concept-sketch.png");
  form.append("prompt", prompt);
  form.append("size", "1536x1024");
  form.append("quality", "medium");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
  let response;
  try {
    response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error?.message ?? `Image colourise failed with status ${response.status}.`);
  }
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("Image colourise returned no image data.");
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: "image/png" });
}

function buildColorizePrompt(option) {
  return [
    "Turn this exact architectural elevation sketch into a realistic exterior render of an Australian custom home.",
    "Keep the geometry identical: same proportions, storeys, roofline, window and door positions, and massing exactly as drawn. Do not add or remove any building elements.",
    `Apply these materials: ${option.materials.join(", ")}.`,
    option.style ? `Overall feel: ${option.style}.` : "",
    "Natural Australian daylight, realistic soft landscaping in the foreground, plausible Australian setting.",
    "No text, no signage, no logos, no watermarks, no people.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildHeroPrompt(option) {
  return [
    "Generate a realistic exterior architectural concept render of an Australian custom home.",
    "Use this locked design specification exactly:",
    `- Concept: ${option.name}`,
    `- Style: ${option.style}`,
    `- Storeys: ${option.storeys}`,
    option.bedrooms ? `- Bedrooms: ${option.bedrooms}` : "",
    option.roofForm ? `- Roof form: ${option.roofForm}` : "",
    `- Facade materials: ${option.materials.join(", ")}`,
    option.keyIdea ? `- Key idea: ${option.keyIdea}` : "",
    "Composition: eye-level 3/4 front view, professional residential architecture render, natural Australian daylight, realistic scale and proportions, plausible Australian suburban or regional context.",
    "Do not add extra storeys, extra garage doors, balconies, chimneys, or materials not in the locked specification.",
    "No text, no signage, no logos, no watermarks, no people. Keep the design plausible and buildable for an Australian custom-home client.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSketchPrompt(option) {
  return [
    "Create a clean architectural concept elevation sketch for an Australian custom home client presentation.",
    "Design lock:",
    `- Concept: ${option.name}`,
    `- Style: ${option.style}`,
    `- Storeys: ${option.storeys}`,
    option.roofForm ? `- Roof form: ${option.roofForm}` : "",
    `- Facade materials: ${option.materials.join(", ")}`,
    "Style requirements: flat pure white background, professional architectural line drawing, black and soft grey linework, subtle shadow only to show depth, no colour beyond minimal grey tone.",
    "No people, cars, logos, fake stamps, fake signatures, fake registration numbers, or fake handwritten notes. No invented annotations.",
    "Do not add rooms, windows, garage doors, balconies, or roof elements not listed in the design lock. Keep it presentation-ready.",
  ]
    .filter(Boolean)
    .join("\n");
}

function cleanConcept(concept) {
  const name = cleanText(concept?.name).slice(0, 120);
  const summary = cleanText(concept?.summary).slice(0, 500);
  if (!name || !summary) return null;
  const materials = (Array.isArray(concept?.materials) ? concept.materials : [])
    .map((material) => cleanText(material).slice(0, 120))
    .filter(Boolean)
    .slice(0, 8);
  return {
    name,
    summary,
    style: cleanText(concept?.style, "modern Australian").slice(0, 160),
    storeys: clampNumber(concept?.storeys, 1, 3, 1),
    ...(Number.isFinite(concept?.bedrooms) ? { bedrooms: clampNumber(concept.bedrooms, 1, 8, 4) } : {}),
    ...(Number.isFinite(concept?.bathrooms) ? { bathrooms: clampNumber(concept.bathrooms, 1, 6, 2) } : {}),
    ...(cleanText(concept?.roofForm) ? { roofForm: cleanText(concept.roofForm).slice(0, 160) } : {}),
    materials: materials.length ? materials : ["metal roof", "fibre cement cladding", "Australian hardwood accents"],
    ...(cleanText(concept?.keyIdea) ? { keyIdea: cleanText(concept.keyIdea).slice(0, 300) } : {}),
    ...(cleanText(concept?.rationale) ? { rationale: cleanText(concept.rationale).slice(0, 1200) } : {}),
    riskFlags: (Array.isArray(concept?.riskFlags) ? concept.riskFlags : [])
      .map((flag) => cleanText(flag).slice(0, 200))
      .filter(Boolean)
      .slice(0, 8),
  };
}

function cleanBrief(brief) {
  return {
    ...(cleanText(brief?.location) ? { location: cleanText(brief.location).slice(0, 200) } : {}),
    ...(cleanText(brief?.stateOrTerritory) ? { stateOrTerritory: cleanText(brief.stateOrTerritory).slice(0, 60) } : {}),
    ...(cleanText(brief?.landStatus) ? { landStatus: cleanText(brief.landStatus).slice(0, 300) } : {}),
    ...(cleanText(brief?.budget) ? { budget: cleanText(brief.budget).slice(0, 120) } : {}),
    ...(cleanText(brief?.household) ? { household: cleanText(brief.household).slice(0, 300) } : {}),
    ...(Array.isArray(brief?.mustHaves)
      ? { mustHaves: brief.mustHaves.map((item) => cleanText(item).slice(0, 160)).filter(Boolean).slice(0, 12) }
      : {}),
    ...(Array.isArray(brief?.avoid)
      ? { avoid: brief.avoid.map((item) => cleanText(item).slice(0, 160)).filter(Boolean).slice(0, 12) }
      : {}),
    ...(cleanText(brief?.notes) ? { notes: cleanText(brief.notes).slice(0, 800) } : {}),
  };
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function cleanText(value, fallback = "") {
  const trimmed = String(value ?? "").trim();
  return trimmed || fallback;
}
