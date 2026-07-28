import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { repositoryRoot } from "./repository.ts";
import {
  allowedUntranslated,
  checkTranslationPolicy,
  type TranslationAllowance,
} from "./translation-policy.ts";

/**
 * A gate over the one quality claim in this repository that nothing checked:
 * that the Dutch catalog is Dutch. Parity compares keys and ICU arguments, so
 * every value could be the English text and every check would stay green.
 *
 * Planted in both directions, like the suppression ratchet: a value that is
 * English where none was allowed, and an allowance left standing after the
 * value it covered was translated.
 */

const workspaces: string[] = [];

function checkout(catalogs: Readonly<Record<string, unknown>>): string {
  const root = mkdtempSync(path.join(tmpdir(), "translation-"));
  workspaces.push(root);

  const directory = path.join(root, "packages/i18n/messages");
  mkdirSync(directory, { recursive: true });
  for (const [locale, catalog] of Object.entries(catalogs)) {
    writeFileSync(
      path.join(directory, `${locale}.json`),
      `${JSON.stringify(catalog, null, 2)}\n`,
    );
  }

  return root;
}

afterAll(() => {
  for (const workspace of workspaces) {
    rmSync(workspace, { force: true, recursive: true });
  }
});

const translated = {
  en: { home: { title: "Announcements", empty: "Nothing yet." } },
  nl: { home: { title: "Aankondigingen", empty: "Nog niets." } },
};

describe("checkTranslationPolicy", () => {
  it("says nothing about a catalog that is actually translated", () => {
    expect(checkTranslationPolicy(checkout(translated), [])).toEqual([]);
  });

  it("reports a value that is the reference text verbatim", () => {
    const root = checkout({
      en: translated.en,
      nl: { home: { title: "Announcements", empty: "Nog niets." } },
    });

    const violations = checkTranslationPolicy(root, []);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.file).toBe("packages/i18n/messages/nl.json");
    expect(violations[0]?.problem).toContain("home.title");
    expect(violations[0]?.problem).toContain("Announcements");
    expect(violations[0]?.fix).toContain("allowedUntranslated");
  });

  it("reports every untranslated value, not only the first", () => {
    const root = checkout({ en: translated.en, nl: translated.en });
    const problems = checkTranslationPolicy(root, []).map(
      (found) => found.problem,
    );

    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain("home.empty");
    expect(problems[1]).toContain("home.title");
  });

  it("accepts a value an allowance covers", () => {
    const root = checkout({
      en: translated.en,
      nl: { home: { title: "Announcements", empty: "Nog niets." } },
    });

    expect(
      checkTranslationPolicy(root, [
        {
          key: "home.title",
          locale: "nl",
          reason: "A loanword Dutch uses unchanged.",
        },
      ]),
    ).toEqual([]);
  });

  it("rejects an allowance that carries no reason", () => {
    const root = checkout({
      en: translated.en,
      nl: { home: { title: "Announcements", empty: "Nog niets." } },
    });

    const violations = checkTranslationPolicy(root, [
      { key: "home.title", locale: "nl", reason: "  " },
    ]);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.problem).toContain("no reason");
  });

  it("reports an allowance for a value that has since been translated", () => {
    const violations = checkTranslationPolicy(checkout(translated), [
      { key: "home.title", locale: "nl", reason: "Was a loanword once." },
    ]);

    expect(violations).toHaveLength(1);
    expect(violations[0]?.file).toBe(
      "packages/tooling/src/translation-policy.ts",
    );
    expect(violations[0]?.problem).toContain("no longer");
  });

  it("reports an allowance for a key no catalog defines", () => {
    const violations = checkTranslationPolicy(checkout(translated), [
      { key: "home.gone", locale: "nl", reason: "Covered a removed message." },
    ]);

    expect(violations).toHaveLength(1);
    expect(violations[0]?.problem).toContain("no longer");
  });

  it("compares every locale against the reference, not only the second one", () => {
    const root = checkout({
      en: translated.en,
      nl: translated.nl,
      de: { home: { title: "Ankündigungen", empty: "Nothing yet." } },
    });

    const violations = checkTranslationPolicy(root, []);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.file).toBe("packages/i18n/messages/de.json");
    expect(violations[0]?.problem).toContain("home.empty");
  });

  it("reports the missing reference catalog rather than passing silently", () => {
    const root = checkout({ nl: translated.nl });
    const violations = checkTranslationPolicy(root, []);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.problem).toContain("en.json");
  });
});

describe("this repository", () => {
  it("ships catalogs that satisfy the gate under the allowlist it declares", () => {
    expect(checkTranslationPolicy(repositoryRoot)).toEqual([]);
  });

  it("gives every allowance a reason a reader can weigh", () => {
    const blank: TranslationAllowance[] = allowedUntranslated.filter(
      (allowance) => allowance.reason.trim().length === 0,
    );
    expect(blank).toEqual([]);
  });
});
