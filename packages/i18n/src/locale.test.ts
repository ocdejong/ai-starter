import { describe, expect, it } from "vitest";

import { defaultLocale, negotiateLocale, parseLocale } from "./locale";

describe("parseLocale", () => {
  it("accepts a supported locale", () => {
    expect(parseLocale("nl")).toBe("nl");
  });

  it("rejects anything untrusted input might carry", () => {
    for (const value of ["de", "", "EN", 42, null, undefined, {}]) {
      expect(parseLocale(value)).toBeNull();
    }
  });
});

describe("negotiateLocale", () => {
  it("returns the highest-weighted supported locale", () => {
    expect(negotiateLocale("nl-NL,nl;q=0.9,en;q=0.8")).toBe("nl");
  });

  it("honours q-weights over source order", () => {
    expect(negotiateLocale("en;q=0.7, nl;q=0.9")).toBe("nl");
  });

  it("matches on the primary subtag", () => {
    expect(negotiateLocale("nl-BE")).toBe("nl");
  });

  it("falls back to the default when nothing is supported", () => {
    expect(negotiateLocale("fr-FR,de;q=0.8")).toBe(defaultLocale);
  });

  it("falls back to the default when the header is absent", () => {
    expect(negotiateLocale(null)).toBe(defaultLocale);
    expect(negotiateLocale(undefined)).toBe(defaultLocale);
  });
});
