import type { Database } from "@ai-starter/db";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createEmailInbox, startAuthHarness } from "../test/harness";
import { initAuth } from "./init-auth";

/**
 * The guard the browser suite is exempt from.
 *
 * Better Auth turns its per-IP limit on for `NODE_ENV === "production"` alone,
 * so it exists only where nothing runs: not in a development server, not in a
 * unit test, and — since `playwright.config.ts` now switches it off — not in a
 * journey either, because fourteen journeys from one address look exactly like
 * one attacker. That leaves this file as the only place the limit is ever met,
 * which is the trade the exemption is worth making: the guard is asserted here
 * rather than tripped over there.
 *
 * The defaults are Better Auth's own and this is what they mean: three requests
 * per ten seconds to `/sign-in`, `/sign-up`, `/change-password` and
 * `/change-email`, counted per address.
 */

const inbox = createEmailInbox();
let container: StartedPostgreSqlContainer;
let client: Database;
let limited: ReturnType<typeof initAuth>;

beforeAll(async () => {
  ({ client, container } = await startAuthHarness(inbox));
  limited = initAuth({
    baseURL: "http://localhost:3000",
    database: client,
    email: inbox.dispatchers,
    // The one thing this instance does differently from the composition root's.
    rateLimit: { enabled: true },
    secret: "integration-secret-integration-secret",
    trustedOrigins: ["ai-starter://"],
  });
}, 120_000);

afterAll(async () => {
  await client.$disconnect();
  await container.stop();
});

/** One sign-up attempt from a fixed address, through the HTTP handler the limiter wraps. */
function signUp(attempt: number): Promise<Response> {
  return limited.handler(
    new Request("http://localhost:3000/api/auth/sign-up/email", {
      body: JSON.stringify({
        email: `attempt-${attempt}@example.com`,
        name: "Test",
        password: "password1234",
      }),
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.7",
      },
      method: "POST",
    }),
  );
}

describe("the auth rate limit", () => {
  it("refuses a fourth attempt from one address inside the window", async () => {
    const statuses: number[] = [];
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      statuses.push((await signUp(attempt)).status);
    }

    // The first three are served — whether each one succeeds is the account
    // flows' business, not this file's — and the fourth is refused.
    expect(statuses.slice(0, 3)).not.toContain(429);
    expect(statuses[3]).toBe(429);
  }, 60_000);
});
