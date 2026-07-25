import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { findDuplicateKeyPaths } from "./duplicate-keys";

describe("findDuplicateKeyPaths", () => {
  it("finds nothing in a catalog whose keys are unique at every level", () => {
    const fixture = `{
      "auth": { "signIn": { "title": "Sign in" }, "signUp": { "title": "Create" } },
      "home": { "title": "AI Starter" }
    }`;
    expect(findDuplicateKeyPaths(fixture)).toEqual([]);
  });

  it("reports a top-level namespace that appears twice", () => {
    // The catalogs are merged textually by parallel agents; a rebase once left
    // "auth" in the file twice and JSON.parse silently kept only the second.
    const fixture = `{
      "auth": { "signIn": { "title": "Sign in" } },
      "home": { "title": "AI Starter" },
      "auth": { "signUp": { "title": "Create" } }
    }`;
    expect(findDuplicateKeyPaths(fixture)).toEqual(["auth"]);
  });

  it("reports the dotted path of a duplicate deep in a nested namespace", () => {
    const fixture = `{
      "auth": { "signIn": { "title": "Sign in", "title": "Log in" } }
    }`;
    expect(findDuplicateKeyPaths(fixture)).toEqual(["auth.signIn.title"]);
  });

  it("reports a duplicate even when both occurrences are textually identical", () => {
    // JSON.parse output is identical with or without the repeat, so only the
    // raw text can reveal this one.
    const fixture = `{ "theme": { "label": "Theme" }, "theme": { "label": "Theme" } }`;
    expect(findDuplicateKeyPaths(fixture)).toEqual(["theme"]);
  });

  it("reports every duplicated level, in source order", () => {
    const fixture = `{ "a": "1", "a": "2", "b": { "c": "1", "c": "2" } }`;
    expect(findDuplicateKeyPaths(fixture)).toEqual(["a", "b.c"]);
  });

  it("compares keys after escape decoding, exactly as JSON.parse would", () => {
    const fixture = String.raw`{ "a": "1", "\u0061": "2" }`;
    expect(findDuplicateKeyPaths(fixture)).toEqual(["a"]);
  });

  it("ignores braces and escaped quotes inside message values", () => {
    const fixture = String.raw`{
      "posts": "{count, plural, =0 {no posts} one {# post} other {# posts}}",
      "quoted": "He said \"hello {name}\" and left a stray } {"
    }`;
    expect(findDuplicateKeyPaths(fixture)).toEqual([]);
  });

  it("walks objects nested inside arrays", () => {
    const fixture = `{ "list": [{ "k": "1" }, { "k": "1", "k": "2" }] }`;
    expect(findDuplicateKeyPaths(fixture)).toEqual(["list[1].k"]);
  });

  it("throws on text that is not valid JSON", () => {
    expect(() => findDuplicateKeyPaths("{")).toThrow(SyntaxError);
    expect(() => findDuplicateKeyPaths(`{ "a" "1" }`)).toThrow(SyntaxError);
    expect(() => findDuplicateKeyPaths(`{ "a": "1" } trailing`)).toThrow(
      SyntaxError,
    );
  });
});

describe("catalog duplicate keys", () => {
  it("defines every key at most once per object level in every locale", () => {
    const messagesDir = new URL("../messages/", import.meta.url);
    const catalogs = readdirSync(messagesDir).filter((file) =>
      file.endsWith(".json"),
    );
    expect(catalogs.length).toBeGreaterThan(0);
    for (const file of catalogs) {
      const raw = readFileSync(new URL(file, messagesDir), "utf8");
      expect(
        findDuplicateKeyPaths(raw),
        `${file} repeats a key — JSON.parse keeps only the last occurrence, silently dropping the rest`,
      ).toEqual([]);
    }
  });
});
