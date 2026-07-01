import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { commandResult } from "../lib/workspaceCommands.js";

export default defineTool({
  description: "Prepare a builder outreach draft that requires human approval before any external contact is sent.",
  inputSchema: z.object({
    builderName: z.string().trim().min(1).max(180),
    draftMessage: z.string().trim().min(1),
  }),
  approval: always(),
  async execute({ builderName, draftMessage }) {
    return commandResult(`Prepared approved outreach draft for ${builderName}.`, [
      {
        type: "create_document",
        target: "doc",
        payload: {
          title: `Outreach draft - ${builderName}`,
          content: draftMessage,
          source: "eve_tool",
        },
      },
    ]);
  },
  toModelOutput(output) {
    return { type: "text", value: output.summary };
  },
});
