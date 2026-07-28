import { describe, expect, it } from "vitest";

import { resolveLocale } from "./resolve-locale";

/**
 * The precedence chain a visitor's language travels, which nothing exercised:
 * the switcher's Playwright journey proves a cookie survives a reload, and the
 * three steps below it — a forged cookie, a negotiated header, the floor — were
 * only ever read.
 */
describe("resolveLocale", () => {
  it("prefers the cookie the visitor set over their browser's language", () => {
    expect(resolveLocale("nl", "en-GB,en;q=0.9")).toBe("nl");
  });

  it("negotiates from the header when no cookie has been set", () => {
    expect(resolveLocale(undefined, "nl-NL,nl;q=0.9,en;q=0.8")).toBe("nl");
  });

  it("ignores a cookie value this product does not ship", () => {
    // The cookie is client-supplied, so "de" — or a script tag — arrives here
    // exactly as easily as "nl" does.
    expect(resolveLocale("de", "nl-NL")).toBe("nl");
    expect(resolveLocale("<script>", null)).toBe("en");
  });

  it("falls back to English when nothing matches", () => {
    expect(resolveLocale(undefined, "de-DE,fr;q=0.8")).toBe("en");
    expect(resolveLocale(undefined, null)).toBe("en");
  });
});
