import { defaultBackend, defineSandbox } from "eve/sandbox";

export default defineSandbox({
  backend: defaultBackend({
    docker: { pullPolicy: "if-not-present" },
    microsandbox: { memoryMiB: 4096 },
  }),
  revalidationKey: () => "dwella-file-processor-v1",
  async bootstrap({ use }) {
    const sandbox = await use();
    await sandbox.run({
      command: [
        "set -e",
        "mkdir -p /workspace/attachments /workspace/processed-files",
        "if command -v python3 >/dev/null 2>&1; then python3 -m pip install --user --quiet pypdf python-docx openpyxl pillow beautifulsoup4 || true; fi",
      ].join("\n"),
    });
  },
});
