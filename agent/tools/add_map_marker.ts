import { defineTool } from "eve/tools";
import { z } from "zod";
import { commandResult, createMarkerId } from "../lib/workspaceCommands.js";

export default defineTool({
  description: "Add a marker to the Dwella project map.",
  inputSchema: z.object({
    label: z.string().trim().min(1).max(120).default("Marker"),
    lat: z.number().finite(),
    lng: z.number().finite(),
  }),
  async execute({ label, lat, lng }) {
    return commandResult(`Added ${label} to the map.`, [
      {
        type: "add_map_marker",
        target: "map",
        payload: {
          marker: { id: createMarkerId(), label, lat, lng },
          source: "eve_tool",
        },
      },
    ]);
  },
  toModelOutput(output) {
    return { type: "text", value: output.summary };
  },
});
