import { defineTool } from "eve/tools";
import { z } from "zod";
import { commandResult } from "../lib/workspaceCommands.js";

export default defineTool({
  description: "Replace the active Dwella document body. Use only after the user clearly asks for replacement.",
  inputSchema: z.object({
    text: z.string(),
  }),
  async execute({ text }) {
    return commandResult("Replaced the active document.", [
      {
        type: "replace_document",
        target: "doc",
        payload: { text, source: "eve_tool" },
      },
    ]);
  },
  toModelOutput(output) {
    return { type: "text", value: output.summary };
  },
});
