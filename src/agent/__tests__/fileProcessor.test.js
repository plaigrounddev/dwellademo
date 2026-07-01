import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

test("Dwella file processor extracts, preserves, and redacts uploaded files", async () => {
  const root = path.resolve(path.join(import.meta.dirname, "..", "..", ".."));
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dwella-file-processor-"));
  const inputDir = path.join(tempRoot, "attachments");
  const outputDir = path.join(tempRoot, "processed");
  await mkdir(inputDir, { recursive: true });
  await writeFile(path.join(inputDir, "site-notes.txt"), "Site suburb: Paddington QLD\nSecret Site Name: Jacaranda\n");
  await writeFile(path.join(inputDir, "survey.bin"), Buffer.from([0, 1, 2, 3, 4, 5]));

  const script = path.join(root, "agent", "sandbox", "workspace", "bin", "dwella_file_processor.py");
  const { stdout } = await execFileAsync("python3", [
    script,
    "--input",
    inputDir,
    "--output",
    outputDir,
    "--operation",
    "redact_copy",
    "--redact",
    "Jacaranda",
  ]);

  const manifest = JSON.parse(await readFile(path.join(outputDir, "file-processing-manifest.json"), "utf8"));
  assert.equal(manifest.operation, "redact_copy");
  assert.equal(manifest.fileCount, 2);
  assert.equal(manifest.security.uploadedFilesExecuted, false);
  assert.equal(manifest.security.networkRequired, false);
  assert.equal(manifest.security.malwareScan, "not_performed");
  assert.match(stdout, /site-notes\.txt/);

  const notes = manifest.files.find((file) => file.filename === "site-notes.txt");
  assert.ok(notes?.textExtracted);
  assert.equal(notes.originalPreserved, true);
  assert.match(notes.textPreview, /Paddington/);
  assert.ok(notes.outputs.some((output) => output.includes("/normalized/")), "text uploads should be preserved as normalized originals");
  const redactedPath = notes.outputs.find((output) => output.includes("/redacted/"));
  assert.ok(redactedPath, "redacted text output should be written");
  assert.match(await readFile(redactedPath, "utf8"), /\[REDACTED\]/);

  const binary = manifest.files.find((file) => file.filename === "survey.bin");
  assert.equal(binary?.textExtracted, false);
  assert.equal(binary?.originalPreserved, true);
  assert.ok(binary?.outputs.some((output) => output.includes("/normalized/")), "unknown binaries should be preserved as normalized outputs");
});
