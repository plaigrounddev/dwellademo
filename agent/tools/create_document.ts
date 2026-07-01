import { defineTool } from "eve/tools";
import { z } from "zod";
import { commandResult } from "../lib/workspaceCommands.js";

export default defineTool({
  description: "Create a document in the current Dwella thread workspace for briefs, scopes, quote requests, notes, and plans.",
  inputSchema: z.object({
    title: z.string().trim().min(1).max(180).default("Builder brief"),
    content: z.string().default(""),
  }),
  async execute({ title, content }) {
    return commandResult(`Created document: ${title}.`, [
      {
        type: "create_document",
        target: "doc",
        payload: { title, content, source: "eve_tool" },
      },
    ]);
  },
  toModelOutput(output) {
    return { type: "text", value: output.summary };
  },
});
