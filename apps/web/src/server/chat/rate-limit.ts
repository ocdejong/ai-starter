export type RateLimitWindow = {
  /** Requests permitted inside one window. */
  readonly limit: number;
  readonly windowMs: number;
};

export type RateLimitDecision = {
  readonly allowed: boolean;
  /** Whole seconds until the caller may retry; `0` when the request was allowed. */
  readonly retryAfterSeconds: number;
};

export type SlidingWindowResult = RateLimitDecision & {
  /** Timestamps to keep for this key, including `now` when the request was allowed. */
  readonly retained: number[];
};

/**
 * The sliding-window decision as a pure function of the recorded timestamps and
 * the current instant, so the policy is testable without a clock or a store. A
 * rejected request is not recorded: being over the limit must not extend the
 * window a caller is waiting out.
 */
export function slidingWindow(
  timestamps: readonly number[],
  now: number,
  { limit, windowMs }: RateLimitWindow,
): SlidingWindowResult {
  const cutoff = now - windowMs;
  const live = timestamps.filter((timestamp) => timestamp > cutoff);

  if (live.length < limit) {
    return { allowed: true, retained: [...live, now], retryAfterSeconds: 0 };
  }

  const oldest = live[0] ?? now;
  return {
    allowed: false,
    retained: live,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((oldest + windowMs - now) / 1_000),
    ),
  };
}

export type ChatRateLimiter = {
  (key: string, now: number): RateLimitDecision;
  /** Keys currently held, for tests and diagnostics. */
  size: () => number;
};

/**
 * A per-process sliding-window limiter keyed by user id. In-memory on purpose:
 * it bounds one instance's spend on the example chat and needs no dependency. A
 * deployment running several instances, or one that must enforce a global
 * budget, replaces this with a shared store — the call site takes any function
 * of the same shape.
 */
export function createChatRateLimiter(
  window: RateLimitWindow,
): ChatRateLimiter {
  const hits = new Map<string, number[]>();

  const limiter = (key: string, now: number): RateLimitDecision => {
    const result = slidingWindow(hits.get(key) ?? [], now, window);
    hits.set(key, result.retained);

    // Sweep on write so an instance that has served many users does not hold
    // their keys forever; every entry here is bounded by the same window.
    const cutoff = now - window.windowMs;
    for (const [candidate, timestamps] of hits) {
      if (timestamps.every((timestamp) => timestamp <= cutoff)) {
        hits.delete(candidate);
      }
    }

    return {
      allowed: result.allowed,
      retryAfterSeconds: result.retryAfterSeconds,
    };
  };

  limiter.size = () => hits.size;
  return limiter;
}
