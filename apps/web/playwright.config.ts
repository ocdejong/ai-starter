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

/**
 * Two more servers, on ports derived from this checkout's own.
 *
 * The chat route reads its provider — and whether it has one at all — once, at
 * module scope, so the two states a visitor can see are two processes rather
 * than two requests. `keyless` is a deployment with no provider key, which is
 * what a fresh clone is; `provider` is a stand-in for the Anthropic endpoint
 * that the keyed server is pointed at through `ANTHROPIC_BASE_URL`, so the
 * route, the adapter and the stream are all real while the answer is fixed.
 *
 * The offsets keep both clear of the ports bootstrap derives — web origins span
 * base + 1…200, so nothing here can collide with a sibling worktree's — and
 * clear of the fetch specification's blocked ports, which both Node and Chromium
 * refuse outright. The obvious +1000 lands a worktree on 4045, one of them, and
 * the refusal arrives as `bad port` from inside the provider SDK's retry loop.
 * Nothing in 8000…8050 or 9000…9050 is blocked.
 *
 * The offset is a preference, not the answer: `reuseExistingServer` is on
 * locally, so a derived port that something else already holds would be adopted
 * as if it were this suite's server — a primary checkout derives 9000, which on
 * a machine running php-fpm is taken. Each port is therefore probed, and the
 * first free one at or after the preference wins.
 */
const providerOrigin = await stableFreeOrigin(
  "E2E_PROVIDER_ORIGIN",
  5_000,
  "127.0.0.1",
);
const keylessOrigin = await stableFreeOrigin("E2E_KEYLESS_ORIGIN", 6_000);

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

/** The one spec that must meet a deployment without a provider key. */
const keylessSpec = /chat-not-configured\.spec\.ts$/;

function webCommand(onPort: string): string {
  return process.env.CI
    ? `pnpm start --port ${onPort}`
    : `pnpm dev --port ${onPort}`;
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
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: keylessSpec,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-keyless",
      testMatch: keylessSpec,
      use: { ...devices["Desktop Chrome"], baseURL: keylessOrigin },
    },
  ],
  webServer: [
    {
      command: `node scripts/fake-anthropic.ts --port ${new URL(providerOrigin).port}`,
      reuseExistingServer: !process.env.CI,
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
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      url: baseURL,
    },
    {
      command: webCommand(new URL(keylessOrigin).port),
      env: {
        // The state a clone with no vendor keys boots into. An empty value is
        // how the env schema spells "unset", and it beats whatever the ambient
        // environment carries.
        ANTHROPIC_API_KEY: "",
        BETTER_AUTH_RATE_LIMIT_DISABLED: "true",
        // Its own origin, so nothing it renders or sets a cookie for belongs to
        // the keyed server. Both servers share this checkout's `.next` and its
        // database; only the chat configuration differs.
        BETTER_AUTH_URL: keylessOrigin,
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      url: keylessOrigin,
    },
  ],
});
