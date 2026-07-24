import { describe, expect, it } from "vitest";

import { createChatRateLimiter, slidingWindow } from "./rate-limit";

const window = { limit: 3, windowMs: 60_000 };

describe("slidingWindow", () => {
  it("allows a request when the window is empty", () => {
    const result = slidingWindow([], 1_000, window);

    expect(result.allowed).toBe(true);
    expect(result.retained).toEqual([1_000]);
  });

  it("allows requests up to the limit and records each one", () => {
    const result = slidingWindow([100, 200], 300, window);

    expect(result.allowed).toBe(true);
    expect(result.retained).toEqual([100, 200, 300]);
  });

  it("rejects the request that exceeds the limit without recording it", () => {
    const result = slidingWindow([100, 200, 300], 400, window);

    expect(result.allowed).toBe(false);
    expect(result.retained).toEqual([100, 200, 300]);
  });

  it("forgets timestamps that have left the window", () => {
    // At 60_250 the window opens at 250, so 100 and 200 have aged out and the
    // key is under the limit again even though three requests were recorded.
    const result = slidingWindow([100, 200, 300], 60_250, window);

    expect(result.allowed).toBe(true);
    expect(result.retained).toEqual([300, 60_250]);
  });

  it("reports when the oldest timestamp leaves the window, rounded up", () => {
    const result = slidingWindow([1_000, 2_000, 3_000], 4_000, window);

    expect(result.allowed).toBe(false);
    // The oldest (1_000) expires at 61_000, which is 57 seconds away.
    expect(result.retryAfterSeconds).toBe(57);
  });

  it("never reports a retry-after below one second", () => {
    const result = slidingWindow([1_000, 2_000, 3_000], 60_999, window);

    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(1);
  });
});

describe("createChatRateLimiter", () => {
  it("counts each key independently", () => {
    const limit = createChatRateLimiter({ limit: 1, windowMs: 60_000 });

    expect(limit("alice", 0).allowed).toBe(true);
    expect(limit("bob", 0).allowed).toBe(true);
    expect(limit("alice", 1).allowed).toBe(false);
  });

  it("lets a key through again once its window has passed", () => {
    const limit = createChatRateLimiter({ limit: 1, windowMs: 60_000 });

    expect(limit("alice", 0).allowed).toBe(true);
    expect(limit("alice", 30_000).allowed).toBe(false);
    expect(limit("alice", 60_001).allowed).toBe(true);
  });

  it("drops keys whose windows have fully expired", () => {
    const limit = createChatRateLimiter({ limit: 1, windowMs: 60_000 });

    limit("alice", 0);
    limit("bob", 0);
    expect(limit.size()).toBe(2);

    limit("carol", 60_001);
    expect(limit.size()).toBe(1);
  });
});
