import { defineTool } from "eve/tools";
import { z } from "zod";
import { commandResult, openArtifact } from "../lib/workspaceCommands.js";

const targetSchema = z.enum(["doc", "map", "browser", "files"]);

export default defineTool({
  description: "Show one Dwella workspace artifact panel in the app shell.",
  inputSchema: z.object({
    target: targetSchema,
  }),
  async execute({ target }) {
    return commandResult(`Opened the ${target} workspace panel.`, [openArtifact(target)]);
  },
  toModelOutput(output) {
    return { type: "text", value: output.summary };
  },
});
