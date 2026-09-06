import { readFileSync, statSync } from "node:fs";
import { createServer } from "node:net";
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
const useBuild =
  Boolean(process.env.CI) || process.env.E2E_USE_BUILD === "true";

/** The local provider stub keeps the real chat route and stream deterministic. */
const providerOrigin = await stableFreeOrigin(
  "E2E_PROVIDER_ORIGIN",
  5_000,
  "127.0.0.1",
);

/**
 * The probe runs once per suite, not once per process.
 *
 * Playwright evaluates this file again inside every worker, and a probe that
 * runs twice can answer twice: the main process starts a server on the port it
 * found free, and a worker — finding that same port now taken, by that very
 * server — moves to the next one and drives an origin nothing is listening on.
 * The result is `ERR_CONNECTION_REFUSED` against a port one above the right one,
 * which reads like a server that failed to start. Workers are spawned from this
 * process, so recording the answer in the environment is what makes them agree.
 */
async function stableFreeOrigin(
  variable: string,
  offset: number,
  hostname?: string,
): Promise<string> {
  const decided = process.env[variable];
  if (decided !== undefined && decided !== "") {
    return decided;
  }

  const resolved = await freeOriginAtOffset(baseURL, offset, hostname);
  process.env[variable] = resolved;
  return resolved;
}

/**
 * The provider origin is addressed by literal loopback rather than by name: the
 * server that reaches it is Node's `fetch`, which resolves `localhost` in DNS
 * order and so tries `::1` first, while the fake binds `127.0.0.1` alone. The
 * request fails, the SDK retries, and the browser sees a chat that never
 * answers — a failure whose cause is nowhere near the assertion.
 */
async function freeOriginAtOffset(
  origin: string,
  offset: number,
  hostname?: string,
): Promise<string> {
  const url = new URL(origin);
  const preferred = Number(url.port || "3000") + offset;

  for (let candidate = preferred; candidate < preferred + 50; candidate += 1) {
    if (await isFree(candidate)) {
      url.port = String(candidate);
      if (hostname !== undefined) {
        url.hostname = hostname;
      }
      return url.origin;
    }
  }

  throw new Error(
    `No free port between ${preferred} and ${preferred + 49} for the browser suite's extra servers.`,
  );
}

/** Free means this process can bind it; the server Playwright starts binds it next. */
function isFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => {
      resolve(false);
    });
    server.once("listening", () => {
      server.close(() => {
        resolve(true);
      });
    });
    server.listen(port, "127.0.0.1");
  });
}

function webCommand(onPort: string): string {
  return useBuild ? `pnpm start --port ${onPort}` : `pnpm dev --port ${onPort}`;
}

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
  retries: process.env.CI ? 1 : 0,
  ...(process.env.CI ? { workers: 2 } : {}),
  reporter: process.env.CI
    ? [["line"], ["github"], ["html", { open: "never" }]]
    : "list",
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
  webServer: [
    {
      command: `node scripts/fake-anthropic.ts --port ${new URL(providerOrigin).port}`,
      reuseExistingServer: !useBuild,
      timeout: 30_000,
      url: providerOrigin,
    },
    {
      command: webCommand(port),
      env: {
        // The chat composer is disabled unless a provider key is configured, and
        // the model factory reads both of these once at module scope. The key is
        // never used: `ANTHROPIC_BASE_URL` sends the request to the fake server
        // above instead of to Anthropic, so the route, the provider adapter and
        // the stream are exercised for real and the answer is still fixed. A key
        // the environment already carries is deliberately ignored — a journey
        // must never reach a real provider.
        ANTHROPIC_API_KEY: "sk-ant-not-a-real-key",
        ANTHROPIC_BASE_URL: providerOrigin,
        // Every journey here registers, signs in and changes credentials from
        // one address, and Better Auth's per-IP limit — which only exists in
        // production, which is what CI serves — counts that as one attacker.
        // `packages/auth`'s integration suite keeps the guard covered.
        BETTER_AUTH_RATE_LIMIT_DISABLED: "true",
        // The journeys read the mail they trigger, and the dev mailbox is
        // confined to development because it puts action links on disk. CI
        // serves a production build, so the suite has to ask for it back.
        EMAIL_DEV_MAILBOX_ENABLED: "true",
      },
      reuseExistingServer: !useBuild,
      timeout: 120_000,
      url: baseURL,
    },
  ],
});
