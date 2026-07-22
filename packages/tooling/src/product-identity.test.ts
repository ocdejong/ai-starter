import { describe, expect, it } from "vitest";

import {
  deriveProductIdentity,
  IdentityError,
  identityTokens,
  toSlug,
} from "./product-identity.ts";
import { starterIdentity } from "./starter-identity.ts";

describe("toSlug", () => {
  it("lower-cases words and joins them with single hyphens", () => {
    expect(toSlug("Acme Notes")).toBe("acme-notes");
    expect(toSlug("  Acme   Notes!  ")).toBe("acme-notes");
  });

  it("strips diacritics so the result is a valid package name", () => {
    expect(toSlug("Café Réservations")).toBe("cafe-reservations");
  });
});

describe("deriveProductIdentity", () => {
  it("derives every identifier from the product name alone", () => {
    const identity = deriveProductIdentity(
      { name: "Acme Notes" },
      starterIdentity,
    );

    expect(identity).toEqual({
      applicationId: "com.example.acmenotes",
      compactSlug: "acmenotes",
      displayName: "Acme Notes",
      scope: "acme-notes",
      slug: "acme-notes",
    });
  });

  it("accepts an explicit scope and application identifier", () => {
    const identity = deriveProductIdentity(
      { applicationId: "com.acme.notes", name: "Acme Notes", scope: "@acme" },
      starterIdentity,
    );

    expect(identity.scope).toBe("acme");
    expect(identity.applicationId).toBe("com.acme.notes");
  });

  it.each([
    ["an empty name", { name: "   " }],
    ["a name that produces no letters", { name: "42" }],
    ["an invalid scope", { name: "Acme Notes", scope: "Acme Notes" }],
    [
      "an application identifier that is not reverse-DNS",
      { applicationId: "acme", name: "Acme Notes" },
    ],
  ])("rejects %s", (_case, input) => {
    expect(() => deriveProductIdentity(input, starterIdentity)).toThrow(
      IdentityError,
    );
  });

  it("rejects a product identity that still embeds a starter identifier", () => {
    expect(() =>
      deriveProductIdentity(
        { name: `${starterIdentity.displayName} Pro` },
        starterIdentity,
      ),
    ).toThrow(/still contains the starter identifier/);
  });
});

describe("identityTokens", () => {
  it("orders tokens longest first so specific identifiers match first", () => {
    const lengths = identityTokens(starterIdentity).map(
      (token) => token.length,
    );

    expect(lengths).toEqual([...lengths].sort((left, right) => right - left));
  });

  it("includes the scope with its separator so package names match exactly", () => {
    expect(identityTokens(starterIdentity)).toContain(
      `@${starterIdentity.scope}/`,
    );
  });
});
