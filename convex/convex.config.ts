import { defineApp } from "convex/server";
import { v } from "convex/values";
import durableAgents from "convex-durable-agents/convex.config.js";
import prosemirrorSync from "@convex-dev/prosemirror-sync/convex.config.js";

const app = defineApp({
  env: {
    OPENAI_API_KEY: v.optional(v.string()),
    OPENAI_TEXT_MODEL: v.optional(v.string()),
    OPENAI_TRANSCRIBE_MODEL: v.optional(v.string()),
  },
});

app.use(durableAgents);
app.use(prosemirrorSync);

export default app;
