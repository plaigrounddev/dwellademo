import { defineTool } from "eve/tools";
import { z } from "zod";
import { commandResult } from "../lib/workspaceCommands.js";

export default defineTool({
  description: "Set the Dwella browser sandbox address field.",
  inputSchema: z.object({
    url: z.string().trim().min(1).max(500),
  }),
  async execute({ url }) {
    return commandResult(`Opened ${url} in the browser panel.`, [
      {
        type: "set_browser_url",
        target: "browser",
        payload: { url, source: "eve_tool" },
      },
    ]);
  },
  toModelOutput(output) {
    return { type: "text", value: output.summary };
  },
});
