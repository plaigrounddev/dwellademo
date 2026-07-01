import { spawn } from "node:child_process";
import { loadLocalEnv } from "./load-local-env.mjs";

const HOST = process.env.E2E_EVE_HOST ?? "127.0.0.1";
const PORT = process.env.E2E_EVE_PORT ?? "3000";

await loadLocalEnv();

const child = spawn("npx", ["eve", "start", "--host", HOST, "--port", PORT], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    HOST,
    PORT,
    NITRO_HOST: HOST,
    NITRO_PORT: PORT,
  },
  stdio: "inherit",
});

const stop = (signal) => {
  if (child.exitCode === null && !child.signalCode) {
    child.kill(signal);
  }
};

process.once("SIGINT", () => stop("SIGINT"));
process.once("SIGTERM", () => stop("SIGTERM"));

child.once("exit", (code, signal) => {
  if (signal) {
    process.exit(signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 1);
    return;
  }
  process.exit(code ?? 0);
});
