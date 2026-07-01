import { defineTool } from "eve/tools";
import { z } from "zod";
import { commandResult } from "../lib/workspaceCommands.js";

export default defineTool({
  description: "Create a file entry in the current Dwella thread workspace.",
  inputSchema: z.object({
    name: z.string().trim().min(1).max(180),
  }),
  async execute({ name }) {
    return commandResult(`Created file entry: ${name}.`, [
      {
        type: "create_file",
        target: "files",
        payload: { name, source: "eve_tool" },
      },
    ]);
  },
  toModelOutput(output) {
    return { type: "text", value: output.summary };
  },
});
