import { defineTool } from "eve/tools";
import { z } from "zod";
import { commandResult } from "../lib/workspaceCommands.js";

export default defineTool({
  description: "Export a Dwella document or builder brief as a downloadable PDF or DOC file for the user.",
  inputSchema: z.object({
    title: z.string().trim().min(1).max(180).default("Builder brief"),
    content: z.string().min(1),
    format: z.enum(["pdf", "doc"]).default("pdf"),
  }),
  async execute({ title, content, format }) {
    return commandResult(`Prepared ${title}.${format} for download.`, [
      {
        type: "export_document",
        target: "files",
        payload: { title, content, format, source: "eve_tool" },
      },
    ]);
  },
  toModelOutput(output) {
    return { type: "text", value: output.summary };
  },
});
