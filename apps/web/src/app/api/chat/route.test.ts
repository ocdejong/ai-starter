/**
 * @vitest-environment node
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { startFakeAnthropic, type FakeAnthropic } from "~/test/fake-anthropic";

/**
 * The composition root, exercised as one piece.
 *
 * `handler.test.ts` proves the guards against injected doubles and
 * `rate-limit.test.ts` proves the window; neither says the route hands the
 * handler the right session, the right model or a limiter at all. So this file
 * imports `route.ts` itself and replaces exactly one thing — the session, which
 * needs a database — leaving the model factory, the real limiter with the
 * route's own window, and the provider adapter to run for real against a fake
 * Anthropic endpoint.
 */

const { sessionRef } = vi.hoisted(() => ({
  sessionRef: { current: null as { readonly user: { id: string } } | null },
}));

vi.mock("~/server/better-auth/server", () => ({
  getSession: () => Promise.resolve(sessionRef.current),
}));

const answer = "The fake provider answered.";

let fake: FakeAnthropic;

beforeAll(async () => {
  fake = await startFakeAnthropic({ text: answer });
});

afterAll(async () => {
  await fake.close();
});

afterEach(() => {
  sessionRef.current = null;
  vi.unstubAllEnvs();
});

/**
 * Every variable `~/env` requires, plus the provider configuration under test.
 * `AI_CHAT_MODEL` is deliberately left unset so the route asks for the model the
 * schema defaults to — only the endpoint is fake here, not the request.
 */
function configure(providerKey: string | undefined): void {
  vi.stubEnv("ANTHROPIC_API_KEY", providerKey ?? "");
  vi.stubEnv("ANTHROPIC_BASE_URL", fake.baseUrl);
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  vi.stubEnv("DATABASE_URL", "postgresql://user:password@localhost:5432/test");
}

/** The route reads its environment once, at module scope, exactly as it does in a server. */
async function loadRoute(): Promise<(request: Request) => Promise<Response>> {
  vi.resetModules();
  const { POST } = await import("./route");
  return POST;
}

function chatRequest(text: string): Request {
  return new Request("http://localhost/api/chat", {
    body: JSON.stringify({
      id: "conversation-1",
      messages: [{ id: "m1", parts: [{ text, type: "text" }], role: "user" }],
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

describe("POST /api/chat", () => {
  it("refuses a signed-out caller", async () => {
    configure("sk-ant-fake");
    const post = await loadRoute();

    const response = await post(chatRequest("Are you there?"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toStrictEqual({
      error: "unauthorized",
    });
  });

  it("says so when the deployment has no provider key", async () => {
    configure(undefined);
    sessionRef.current = { user: { id: "user-1" } };
    const post = await loadRoute();

    const response = await post(chatRequest("Are you there?"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toStrictEqual({
      error: "chat_not_configured",
    });
  });

  it("rejects a body the wire contract does not accept", async () => {
    configure("sk-ant-fake");
    sessionRef.current = { user: { id: "user-1" } };
    const post = await loadRoute();

    const response = await post(
      new Request("http://localhost/api/chat", {
        body: JSON.stringify({ messages: [] }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toStrictEqual({
      error: "invalid_request",
    });
  });

  it("streams the provider's answer as a UI message stream", async () => {
    configure("sk-ant-fake");
    sessionRef.current = { user: { id: "user-1" } };
    const post = await loadRoute();

    const response = await post(chatRequest("Are you there?"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-vercel-ai-ui-message-stream")).toBe("v1");
    await expect(response.text()).resolves.toContain(answer);
  });

  it("spends the window the route configures, then refuses", async () => {
    configure("sk-ant-fake");
    sessionRef.current = { user: { id: "user-1" } };
    const post = await loadRoute();

    // The route builds its own limiter at 20 requests a minute. Nothing but the
    // module under test decides that number, which is the point: a route wired
    // without a limiter would answer the twenty-first as happily as the first.
    for (let sent = 0; sent < 20; sent += 1) {
      const allowed = await post(chatRequest("Are you there?"));
      expect(allowed.status).toBe(200);
      await allowed.text();
    }

    const refused = await post(chatRequest("Are you there?"));

    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
    await expect(refused.json()).resolves.toStrictEqual({
      error: "rate_limited",
    });
  });
});
