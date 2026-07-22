import { describe, expect, it } from "vitest";

import { deriveProductIdentity } from "./product-identity.ts";
import { starterIdentity } from "./starter-identity.ts";
import {
  applyReplacements,
  buildIdentityReplacements,
  findOccurrences,
} from "./text-replacement.ts";

const product = deriveProductIdentity(
  { applicationId: "com.acme.notes", name: "Acme Notes", scope: "acme" },
  starterIdentity,
);
const replacements = buildIdentityReplacements(starterIdentity, product);

describe("applyReplacements", () => {
  it("rewrites the workspace scope without touching the slug rule", () => {
    const source = `import { colors } from "@${starterIdentity.scope}/tokens";`;

    expect(applyReplacements(source, replacements)).toBe(
      'import { colors } from "@acme/tokens";',
    );
  });

  it("prefers the application identifier over the compact slug it contains", () => {
    const source = `appId: ${starterIdentity.applicationId}`;

    expect(applyReplacements(source, replacements)).toBe(
      "appId: com.acme.notes",
    );
  });

  it("rewrites the slug, compact slug and display name", () => {
    const source = [
      starterIdentity.slug,
      starterIdentity.compactSlug,
      starterIdentity.displayName,
    ].join("|");

    expect(applyReplacements(source, replacements)).toBe(
      "acme-notes|acmenotes|Acme Notes",
    );
  });

  it("never rescans its own output", () => {
    const doubling = [{ from: "a", to: "aa" }];

    expect(applyReplacements("aaa", doubling)).toBe("aaaaaa");
  });

  it("returns the content unchanged when there is nothing to replace", () => {
    expect(applyReplacements("unrelated text", replacements)).toBe(
      "unrelated text",
    );
  });
});

describe("findOccurrences", () => {
  it("reports one-based line and column positions", () => {
    const content = `first\nsecond ${starterIdentity.slug} tail\n`;

    expect(findOccurrences(content, [starterIdentity.slug])).toEqual([
      { column: 8, line: 2, token: starterIdentity.slug },
    ]);
  });

  it("reports every occurrence on a line", () => {
    const content = `${starterIdentity.slug} ${starterIdentity.slug}`;

    expect(findOccurrences(content, [starterIdentity.slug])).toHaveLength(2);
  });

  it("finds nothing in text without the tokens", () => {
    expect(findOccurrences("acme-notes", [starterIdentity.slug])).toEqual([]);
  });
});
