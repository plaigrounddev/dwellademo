export type ArtifactTarget = "doc" | "map" | "browser" | "files";

export type DwellaScreenCommand = {
  type: string;
  target: ArtifactTarget | "conversation";
  payload?: Record<string, unknown>;
};

export function commandResult(summary: string, screenCommands: DwellaScreenCommand[]) {
  return { summary, screenCommands };
}

export function openArtifact(target: ArtifactTarget, source = "eve_tool"): DwellaScreenCommand {
  return { type: "open_artifact", target, payload: { source } };
}

export function createMarkerId() {
  return `eve-marker-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
