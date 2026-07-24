import { describe, expect, it } from "vitest";

import en from "../messages/en.json";
import nl from "../messages/nl.json";

type Catalog = { readonly [key: string]: string | Catalog };

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

/** The named ICU arguments a message reads, ignoring plural submessage literals and `#`. */
function placeholders(message: string): Set<string> {
  const names = new Set<string>();
  for (const match of message.matchAll(/\{\s*([a-zA-Z0-9_]+)\s*[,}]/g)) {
    const name = match[1];
    if (name !== undefined) {
      names.add(name);
    }
  }
  return names;
}

const english = flatten(en);
const dutch = flatten(nl);

describe("catalog parity", () => {
  it("defines the identical set of message keys in every locale", () => {
    expect([...dutch.keys()].sort()).toEqual([...english.keys()].sort());
  });

  it("reads the identical ICU arguments for every shared key", () => {
    for (const [key, message] of english) {
      const translated = dutch.get(key);
      if (translated === undefined) {
        continue; // key-set mismatch is the other test's failure to report.
      }
      expect(
        [...placeholders(translated)].sort(),
        `arguments diverge for "${key}"`,
      ).toEqual([...placeholders(message)].sort());
    }
  });

  it("leaves no message empty in either locale", () => {
    for (const leaves of [english, dutch]) {
      for (const [key, message] of leaves) {
        expect(message.trim().length, `"${key}" is empty`).toBeGreaterThan(0);
      }
    }
  });
});
