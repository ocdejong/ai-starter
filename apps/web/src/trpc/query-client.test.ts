import type * as ReactQuery from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { createQueryClient, shouldRetryQuery } from "./query-client";

const runtime = vi.hoisted(() => ({ isServer: false }));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactQuery>()),
  get isServer() {
    return runtime.isServer;
  },
}));

describe("shouldRetryQuery", () => {
  it.each(["PRECONDITION_FAILED", "FORBIDDEN", "UNAUTHORIZED", "NOT_FOUND"])(
    "does not retry %s, because asking again cannot change the answer",
    (code) => {
      expect(shouldRetryQuery({ data: { code } })).toBe(false);
    },
  );

  it("retries a failure that carries no refusal from the server", () => {
    expect(shouldRetryQuery(new Error("offline"))).toBe(true);
    expect(shouldRetryQuery({ data: { code: "INTERNAL_SERVER_ERROR" } })).toBe(
      true,
    );
  });
});

describe("createQueryClient", () => {
  /**
   * The retry policy as a browser or the server would see it. TanStack decides
   * which it is once, when its module loads, so the test stands in for that
   * answer instead of trying to reload the library.
   */
  function retryPolicy(environment: "browser" | "server") {
    runtime.isServer = environment === "server";
    const retry = createQueryClient().getDefaultOptions().queries?.retry;
    if (typeof retry !== "function") {
      throw new Error("the default retry policy is not a function");
    }
    return (failureCount: number, error: unknown) =>
      retry(failureCount, error as Error);
  }

  it("stops asking after refusals, so a screen reaches its error state at once", () => {
    const retry = retryPolicy("browser");

    expect(retry(0, { data: { code: "PRECONDITION_FAILED" } })).toBe(false);
  });

  it("keeps retrying a transport failure in the browser, but never forever", () => {
    const retry = retryPolicy("browser");

    expect(retry(0, new Error("offline"))).toBe(true);
    expect(retry(2, new Error("offline"))).toBe(true);
    expect(retry(3, new Error("offline"))).toBe(false);
  });

  it("does not retry on the server, where a render is waiting on the answer", () => {
    const retry = retryPolicy("server");

    expect(retry(0, new Error("offline"))).toBe(false);
  });
});
