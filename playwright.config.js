import { defineConfig } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5175";
const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? "chrome";
const appPort = new URL(baseURL).port || "5175";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  reporter: [["list"]],
  webServer: [
    {
      command: "npm run eve:e2e",
      url: "http://127.0.0.1:3000/eve/v1/health",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: `VITE_DWELLA_EVE_URL=http://127.0.0.1:3000 vite --host 127.0.0.1 --port ${appPort} --strictPort`,
      url: baseURL,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
  use: {
    baseURL,
    channel: browserChannel,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
