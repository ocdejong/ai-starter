import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

import { resolveWebOrigin } from "./src/test/web-origin";

/**
 * The origin the browser drives, and the port the server it starts listens on.
 *
 * It must be the same origin `BETTER_AUTH_URL` names: the auth server builds
 * emailed action links from that variable, and a session cookie set on one
 * origin is invisible to another — so a mismatch breaks the journey that
 * follows a confirmation link. The default therefore comes from `.env`'s own
 * `BETTER_AUTH_URL` — bootstrap derives a distinct one per git worktree — so
 * sibling checkouts verify at once instead of one silently driving (and
 * asserting against) the other's dev server. `E2E_BASE_URL` still overrides
 * the origin explicitly; set it together with `BETTER_AUTH_URL`.
 */
const baseURL = resolveWebOrigin(process.env.E2E_BASE_URL, readEnvFile());
const port = new URL(baseURL).port || "3000";

function readEnvFile(): string | undefined {
  try {
    return readFileSync(
      fileURLToPath(new URL(".env", import.meta.url)),
      "utf8",
    );
  } catch {
    return undefined;
  }
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: process.env.CI
      ? `pnpm start --port ${port}`
      : `pnpm dev --port ${port}`,
    env: {
      // The chat composer is disabled unless a provider key is configured, and
      // the model factory reads this once at module scope — so the dashboard
      // journey needs it set before the server starts. No request reaches the
      // provider: the journey stubs `/api/chat` in the browser.
      ANTHROPIC_API_KEY:
        process.env.ANTHROPIC_API_KEY ?? "sk-ant-not-a-real-key",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: baseURL,
  },
});
