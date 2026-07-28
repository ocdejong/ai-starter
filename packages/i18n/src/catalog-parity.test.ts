import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { icuArguments } from "./icu-arguments";
import { defaultLocale, locales, type Locale } from "./locale";

type Catalog = { readonly [key: string]: string | Catalog };

const messagesDirectory = new URL("../messages/", import.meta.url);

/** Every leaf message, keyed by its dotted path, so nested namespaces compare deeply. */
function flatten(catalog: Catalog, prefix = ""): Map<string, string> {
  const leaves = new Map<string, string>();
  for (const [key, value] of Object.entries(catalog)) {
    const path = prefix === "" ? key : `${prefix}.${key}`;
    if (typeof value === "string") {
      leaves.set(path, value);
    } else {
      for (const [nested, message] of flatten(value, path)) {
        leaves.set(nested, message);
      }
    }
  }
  return leaves;
}

/**
 * Reads a catalog off disk rather than importing two named files.
 *
 * `locale.ts` promises that adding a tag to `locales` and a matching
 * `messages/<tag>.json` is all it takes, and that the new catalog is then held
 * to the same key set as the others. A test that imports `en` and `nl` by name
 * cannot keep that promise: a third locale would be typed, shipped, and never
 * compared to anything. Driving the loop from `locales` is what makes the
 * promise true.
 */
function load(locale: Locale): Map<string, string> {
  const raw = readFileSync(
    new URL(`${locale}.json`, messagesDirectory),
    "utf8",
  );
  return flatten(JSON.parse(raw) as Catalog);
}

const catalogs = new Map(locales.map((locale) => [locale, load(locale)]));

function catalog(locale: Locale): Map<string, string> {
  const found = catalogs.get(locale);
  if (found === undefined) {
    throw new Error(`No catalog was loaded for "${locale}".`);
  }
  return found;
}

const reference = catalog(defaultLocale);
const translations = locales.filter((locale) => locale !== defaultLocale);

describe("catalog parity", () => {
  it("ships one catalog file per declared locale, and no others", () => {
    const files = readdirSync(messagesDirectory).filter((file) =>
      file.endsWith(".json"),
    );
    expect(files.sort()).toEqual(
      [...locales].sort().map((tag) => `${tag}.json`),
    );
  });

  it.each(translations)(
    "defines the identical set of message keys in %s",
    (locale) => {
      expect([...catalog(locale).keys()].sort()).toEqual(
        [...reference.keys()].sort(),
      );
    },
  );

  it.each(translations)(
    "reads the identical ICU arguments for every shared key in %s",
    (locale) => {
      for (const [key, message] of reference) {
        const translated = catalog(locale).get(key);
        if (translated === undefined) {
          continue; // key-set mismatch is the other test's failure to report.
        }
        expect(
          [...icuArguments(translated)].sort(),
          `arguments diverge for "${key}"`,
        ).toEqual([...icuArguments(message)].sort());
      }
    },
  );

  it.each(locales)("leaves no message empty in %s", (locale) => {
    for (const [key, message] of catalog(locale)) {
      expect(message.trim().length, `"${key}" is empty`).toBeGreaterThan(0);
    }
  });
});
