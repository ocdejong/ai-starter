import { defineConfig, devices } from "@playwright/test";

/**
 * The origin the browser drives, and the port the server it starts listens on.
 *
 * It must be the same origin `BETTER_AUTH_URL` names: the auth server builds
 * emailed action links from that variable, and a session cookie set on one
 * origin is invisible to another — so a mismatch breaks the journey that follows
 * a confirmation link. Override both together (they default to the same place)
 * when :3000 is taken, which is what lets two checkouts verify at once instead
 * of one silently driving the other's application.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const port = new URL(baseURL).port || "3000";

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
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: baseURL,
  },
});
