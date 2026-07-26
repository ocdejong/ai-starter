import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

import {
  envFileWebOrigin,
  resolveWebOrigin,
  sharedWebOriginError,
} from "./src/test/web-origin";

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
 *
 * A worktree that bootstrapped before that derivation existed still names the
 * shared origin, so deriving alone cannot keep it off a sibling's server —
 * hence the refusal below, which turns that state into one message naming its
 * fix instead of a suite of failures that look like the product's.
 */
const override = process.env.E2E_BASE_URL;
const baseURL = resolveWebOrigin(override, readEnvFile(".env"));
const port = new URL(baseURL).port || "3000";

if (override === undefined || override === "") {
  const conflict = sharedWebOriginError(
    baseURL,
    exampleOrigin(),
    isLinkedWorktree(),
  );
  if (conflict !== undefined) {
    throw new Error(conflict);
  }
}

function readEnvFile(name: string): string | undefined {
  try {
    return readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8");
  } catch {
    return undefined;
  }
}

function exampleOrigin(): string | undefined {
  const content = readEnvFile(".env.example");
  return content === undefined ? undefined : envFileWebOrigin(content);
}

/** A linked worktree marks its root with a `.git` file; a clone has a directory. */
function isLinkedWorktree(): boolean {
  try {
    return statSync(
      fileURLToPath(new URL("../../.git", import.meta.url)),
    ).isFile();
  } catch {
    return false;
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
