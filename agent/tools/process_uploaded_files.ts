import { defineTool } from "eve/tools";
import { z } from "zod";
import { commandResult } from "../lib/workspaceCommands.js";

const MANIFEST_PATH = "/workspace/processed-files/file-processing-manifest.json";
const MAX_MODEL_PREVIEW_CHARS = 8000;

type ProcessedFile = {
  filename?: string;
  relativePath?: string;
  mediaType?: string;
  bytes?: number;
  sha256?: string;
  textExtracted?: boolean;
  textPreview?: string;
  warnings?: string[];
  outputs?: string[];
};

type ProcessingManifest = {
  operation?: string;
  fileCount?: number;
  files?: ProcessedFile[];
};

export default defineTool({
  description:
    "Read, inspect, extract, and manipulate uploaded files from the Eve sandbox. " +
    "Use this before answering whenever the user attaches files.",
  inputSchema: z.object({
    operation: z.enum(["inspect", "extract", "redact_copy"]).default("extract"),
    redactTerms: z.array(z.string().trim().min(1)).default([]),
    cleanupAttachments: z.boolean().default(true),
  }),
  async execute({ operation, redactTerms, cleanupAttachments }, ctx) {
    const sandbox = await ctx.getSandbox();
    const command = [
      "python3",
      "/workspace/bin/dwella_file_processor.py",
      "--input",
      "/workspace/attachments",
      "--output",
      "/workspace/processed-files",
      "--operation",
      operation,
      ...redactTerms.flatMap((term) => ["--redact", term]),
    ].map(shellArg).join(" ");

    const run = await sandbox.run({ command });
    if (run.exitCode !== 0) {
      return commandResult(
        `Uploaded file processing failed in the Eve sandbox.\n${run.stderr || run.stdout || "No command output was returned."}`,
        [
          {
            type: "show_status",
            target: "conversation",
            payload: { status: "error", source: "process_uploaded_files" },
          },
        ],
      );
    }

    const manifestText = await sandbox.readTextFile({ path: MANIFEST_PATH });
    const manifestContent = manifestText ?? "{}";
    const manifest = parseManifest(manifestContent);
    const files = Array.isArray(manifest.files) ? manifest.files : [];
    const outputFiles = files.flatMap((file) => Array.isArray(file.outputs) ? file.outputs : []);
    const summary = createSummary(manifest, outputFiles);
    const attachmentsCleaned = cleanupAttachments ? await cleanAttachmentStaging(sandbox) : false;

    return {
      ...commandResult(summary, [
        {
          type: "open_artifact",
          target: "files",
          payload: { source: "process_uploaded_files" },
        },
        {
          type: "create_file",
          target: "files",
          payload: {
            name: "file-processing-manifest.json",
            mimeType: "application/json",
            size: manifestContent.length,
            source: MANIFEST_PATH,
          },
        },
        ...outputFiles.slice(0, 8).map((path) => ({
          type: "create_file",
          target: "files",
          payload: {
            name: basename(path),
            mimeType: inferMimeType(path),
            source: path,
          },
        })),
      ]),
      manifest,
      manifestPath: MANIFEST_PATH,
      outputFiles,
      attachmentsCleaned,
      stdout: run.stdout,
      stderr: run.stderr,
    };
  },
  toModelOutput(output) {
    const manifest = (output as { manifest?: ProcessingManifest }).manifest ?? {};
    const files = Array.isArray(manifest.files) ? manifest.files : [];
    const previews = files
      .filter((file) => file.textPreview)
      .map((file) => `## ${file.filename ?? file.relativePath ?? "Uploaded file"}\n${file.textPreview}`)
      .join("\n\n")
      .slice(0, MAX_MODEL_PREVIEW_CHARS);

    return {
      type: "text",
      value: [
        (output as { summary?: string }).summary ?? "Processed uploaded files.",
        "",
        `Manifest: ${(output as { manifestPath?: string }).manifestPath ?? MANIFEST_PATH}`,
        `Outputs: ${((output as { outputFiles?: string[] }).outputFiles ?? []).join(", ") || "none"}`,
        `Raw attachment staging cleaned: ${(output as { attachmentsCleaned?: boolean }).attachmentsCleaned ? "yes" : "no"}`,
        previews ? `\nExtracted previews:\n${previews}` : "",
      ].filter(Boolean).join("\n"),
    };
  },
});

async function cleanAttachmentStaging(sandbox: { run: (input: { command: string }) => Promise<{ exitCode: number }> }) {
  const cleanup = await sandbox.run({
    command: "find /workspace/attachments -mindepth 1 -maxdepth 1 -exec rm -rf -- {} + && mkdir -p /workspace/attachments",
  });
  return cleanup.exitCode === 0;
}

function parseManifest(manifestText: string | null): ProcessingManifest {
  if (!manifestText) return {};
  try {
    const parsed = JSON.parse(manifestText);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function createSummary(manifest: ProcessingManifest, outputFiles: string[]) {
  const files = Array.isArray(manifest.files) ? manifest.files : [];
  const extractedCount = files.filter((file) => file.textExtracted).length;
  const warningCount = files.reduce((count, file) => count + (Array.isArray(file.warnings) ? file.warnings.length : 0), 0);
  return [
    `Processed ${manifest.fileCount ?? files.length} uploaded file(s) in the Eve sandbox with operation "${manifest.operation ?? "extract"}".`,
    `Extracted readable content from ${extractedCount} file(s) and wrote ${outputFiles.length} output artifact(s).`,
    warningCount ? `${warningCount} warning(s) were recorded in the manifest.` : "",
  ].filter(Boolean).join(" ");
}

function shellArg(value: string) {
  return JSON.stringify(value);
}

function basename(path: string) {
  const parts = String(path).split("/");
  return parts[parts.length - 1] || "processed-file";
}

function inferMimeType(path: string) {
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".txt")) return "text/plain";
  if (path.endsWith(".bin")) return "application/octet-stream";
  return "application/octet-stream";
}
