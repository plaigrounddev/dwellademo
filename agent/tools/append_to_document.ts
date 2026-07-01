import { defineTool } from "eve/tools";
import { z } from "zod";
import { commandResult } from "../lib/workspaceCommands.js";

export default defineTool({
  description: "Append dictated or generated text to the active Dwella document editor.",
  inputSchema: z.object({
    text: z.string().trim().min(1),
  }),
  async execute({ text }) {
    return commandResult("Appended text to the active document.", [
      {
        type: "append_to_document",
        target: "doc",
        payload: { text, source: "eve_tool" },
      },
    ]);
  },
  toModelOutput(output) {
    return { type: "text", value: output.summary };
  },
});
