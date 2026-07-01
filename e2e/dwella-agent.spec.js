import { expect, test } from "@playwright/test";
import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { existsSync, readFileSync } from "node:fs";

loadLocalE2eEnv();
const pendingMessageKey = "dwella.pendingAgentMessage";
const testPrompt = "Need a Brisbane duplex quote";
const clerkTestEmail = process.env.E2E_CLERK_EMAIL ?? process.env.CLERK_TEST_USER_EMAIL ?? "";

test("unauthenticated agent prompt redirects to sign-in and preserves the message", async ({ page }) => {
  const agentRequests = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/dwella/agent/runs") {
      agentRequests.push(request);
    }
  });

  await page.goto(`/agent?message=${encodeURIComponent(testPrompt)}`);
  await page.waitForURL(/\/sign-in\?redirect_url=/);

  const currentUrl = new URL(page.url());
  expect(currentUrl.pathname).toBe("/sign-in");
  const redirectTarget = new URL(currentUrl.searchParams.get("redirect_url"), currentUrl.origin);
  expect(redirectTarget.pathname).toBe("/agent");
  expect(redirectTarget.searchParams.get("message")).toBe(testPrompt);
  await expect(page.locator("main.auth-page")).toBeVisible();
  await expect(page.getByLabel("Dwella sign in form")).toBeVisible();
  await expect(page.getByText(/Opening Dwella/i)).toHaveCount(0);
  await expect(page.getByText(/not available right now/i)).toHaveCount(0);

  const storedPrompt = await page.evaluate((key) => window.sessionStorage.getItem(key), pendingMessageKey);
  expect(storedPrompt).toBe(testPrompt);
  expect(agentRequests).toHaveLength(0);
});

test("sign-in route normalizes unsafe redirect targets back to the agent", async ({ page }) => {
  await page.goto("/sign-in?redirect_url=https%3A%2F%2Fevil.example%2Fagent%3Fmessage%3Dsteal");
  await expect.poll(() => new URL(page.url()).searchParams.get("redirect_url")).toBe("/agent");
  await expect(page.locator("main.auth-page")).toBeVisible();
});

test("same-origin agent route reaches the real local Eve runtime without fake fallback text", async ({ request }) => {
  const response = await request.post("/dwella/agent/runs", {
    data: {
      threadId: "thread-e2e-unauth",
      message: "hello",
      history: [],
    },
  });
  const payload = await response.json();

  expect(response.status()).toBe(200);
  expect(payload.status).toBe("completed");
  expect(payload.error).toBeUndefined();
  expect(payload.sessionId).toMatch(/^wrun_/);
  expect(payload.assistantMessage).toEqual(expect.any(String));
  expect(payload.assistantMessage.length).toBeGreaterThan(0);
});

test.describe("authenticated Clerk to Dwella agent", () => {
  test.skip(!clerkTestEmail, "Set E2E_CLERK_EMAIL or CLERK_TEST_USER_EMAIL to run the real signed-in Clerk agent test.");

  test.beforeAll(async () => {
    await clerkSetup({ dotenv: true });
  });

  test("restores the preserved prompt and sends it to the real agent route", async ({ page }) => {
    await page.goto(`/agent?message=${encodeURIComponent(testPrompt)}`);
    await page.waitForURL(/\/sign-in\?redirect_url=/);

    const agentResponsePromise = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/dwella/agent/runs" && response.request().method() === "POST",
      { timeout: 90_000 }
    );
    await clerk.signIn({ page, emailAddress: clerkTestEmail });

    await page.waitForURL(/\/agent/);
    const agentResponse = await agentResponsePromise;
    const requestPayload = agentResponse.request().postDataJSON();
    const responsePayload = await agentResponse.json();

    expect(requestPayload.message).toBe(testPrompt);
    expect(agentResponse.status()).toBe(200);
    expect(responsePayload.status).not.toBe("unauthorized");
    expect(responsePayload.error).toBeUndefined();
    await expect(page.getByText(testPrompt)).toBeVisible();
  });
});

function loadLocalE2eEnv() {
  for (const filename of [".env.local", ".env"]) {
    if (!existsSync(filename)) continue;
    const lines = readFileSync(filename, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match || process.env[match[1]] !== undefined) continue;
      process.env[match[1]] = unquoteEnvValue(match[2]);
    }
  }
}

function unquoteEnvValue(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}
