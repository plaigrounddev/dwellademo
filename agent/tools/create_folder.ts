import { defineTool } from "eve/tools";
import { z } from "zod";
import { commandResult } from "../lib/workspaceCommands.js";

export default defineTool({
  description: "Create a folder in the current Dwella thread workspace.",
  inputSchema: z.object({
    name: z.string().trim().min(1).max(180),
  }),
  async execute({ name }) {
    return commandResult(`Created folder: ${name}.`, [
      {
        type: "create_folder",
        target: "files",
        payload: { name, source: "eve_tool" },
      },
    ]);
  },
  toModelOutput(output) {
    return { type: "text", value: output.summary };
  },
});
