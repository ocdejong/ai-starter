import { beforeEach, describe, expect, it, vi } from "vitest";

import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "./locale-cookie";

const set = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ cookies: () => Promise.resolve({ set }) }));

const { setLocale } = await import("./set-locale");

/**
 * A server action is a public HTTP endpoint. Its argument arrives from whatever
 * posts to it, so the `localeSchema.parse` in front of the cookie write is the
 * boundary — and until now nothing proved it was there.
 */
describe("setLocale", () => {
  beforeEach(() => {
    set.mockClear();
  });

  it("persists a locale this product ships", async () => {
    await setLocale("nl");

    expect(set).toHaveBeenCalledWith(LOCALE_COOKIE, "nl", {
      httpOnly: true,
      maxAge: LOCALE_COOKIE_MAX_AGE,
      path: "/",
      sameSite: "lax",
    });
  });

  it.each([["de"], [""], [null], [{ locale: "nl" }]])(
    "refuses %o and writes no cookie",
    async (value) => {
      await expect(setLocale(value)).rejects.toThrow();
      expect(set).not.toHaveBeenCalled();
    },
  );
});
