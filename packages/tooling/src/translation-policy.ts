import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { type PolicyViolation } from "./policy-violation.ts";

/**
 * A gate over the claim `pnpm verify` could not make: that a translation is a
 * translation.
 *
 * The catalogs are checked for the same keys, the same ICU arguments, no
 * duplicates and no empty values. All four compare *structure*, so of 267 leaf
 * messages roughly two dozen are pinned by Dutch literals in component tests and
 * the rest could be the English text verbatim with every check still green —
 * including every key `pnpm generate feature` writes, which is exactly what it
 * writes, in English, into both catalogs.
 *
 * So the values are compared too. A message identical to the reference locale's
 * is untranslated until somebody says otherwise, in the shrink-only style the
 * suppression ratchet established: the exceptions are listed with a reason, and
 * an entry whose value has since been translated is itself a failure, because a
 * budget nobody spent is one the next change quietly does.
 *
 * Two limits worth naming. Exact equality is the whole test — a Dutch message
 * that differs from English by a comma passes, and no checker can tell that from
 * a real translation. And this finds copy that was never translated, not copy
 * that is *wrong*; only a reader knows the difference between "Opslaan" and a
 * plausible Dutch sentence that says something else.
 *
 * Not checked here, and deliberately: a catalog key nothing renders. The keys
 * under `app.settings.sessions.browser` and `.platform` are reached by building
 * the path from a parsed user-agent, so a checker that looks for each leaf as a
 * string literal in source would need an allowlist on the day it landed. A
 * fragile check is worth less than a named gap.
 */

export type TranslationAllowance = {
  /** Dotted path of the message, as the catalogs nest it. */
  readonly key: string;
  /** The locale whose value may legitimately match the reference catalog's. */
  readonly locale: string;
  /** Why the two languages agree here. Prose for the reader; nothing compares it. */
  readonly reason: string;
};

/**
 * `packages/i18n`'s `defaultLocale`, repeated rather than imported: this package
 * may import no installed dependency, so it reads the catalogs as files the way
 * `native-flow-policy.ts` does. A product that changes its reference locale
 * changes this line too.
 */
const referenceLocale = "en";

const messagesDirectory = "packages/i18n/messages";

const policyModule = "packages/tooling/src/translation-policy.ts";

/**
 * Every message whose Dutch is legitimately the English word.
 *
 * Proper nouns, the endonyms the language switcher lists, the loanwords Dutch
 * software actually uses, and the platform and browser names a session row
 * shows. Each is a word a Dutch reader would be surprised to see translated.
 */
export const allowedUntranslated: readonly TranslationAllowance[] = [
  {
    key: "app.dashboard.title",
    locale: "nl",
    reason: "Dutch software calls this screen a dashboard.",
  },
  {
    key: "app.nav.dashboard",
    locale: "nl",
    reason: "The same loanword, in the navigation.",
  },
  {
    key: "app.settings.account",
    locale: "nl",
    reason: "`Account` is the ordinary Dutch word for it.",
  },
  {
    key: "app.settings.sessions.browser.chrome",
    locale: "nl",
    reason: "A product name; translating it would name a different browser.",
  },
  {
    key: "app.settings.sessions.browser.edge",
    locale: "nl",
    reason: "A product name.",
  },
  {
    key: "app.settings.sessions.browser.firefox",
    locale: "nl",
    reason: "A product name.",
  },
  {
    key: "app.settings.sessions.browser.safari",
    locale: "nl",
    reason: "A product name.",
  },
  {
    key: "app.settings.sessions.platform.android",
    locale: "nl",
    reason: "A platform name.",
  },
  {
    key: "app.settings.sessions.platform.ios",
    locale: "nl",
    reason: "A platform name.",
  },
  {
    key: "app.settings.sessions.platform.linux",
    locale: "nl",
    reason: "A platform name.",
  },
  {
    key: "app.settings.sessions.platform.macos",
    locale: "nl",
    reason: "A platform name.",
  },
  {
    key: "app.settings.sessions.platform.windows",
    locale: "nl",
    reason: "A platform name.",
  },
  {
    key: "home.title",
    locale: "nl",
    reason:
      "The product's own name. `pnpm starter:init` rewrites it in every catalog at once, so the two stay identical downstream.",
  },
  {
    key: "locale.dutch",
    locale: "nl",
    reason:
      "An endonym: the Dutch entry in the language switcher reads `Nederlands` in both catalogs, because that is what the switcher offers.",
  },
  {
    key: "locale.english",
    locale: "nl",
    reason:
      "The English entry is `English` in the Dutch list too, for the same reason: a switcher names each language in its own words.",
  },
  {
    key: "metadata.title",
    locale: "nl",
    reason: "The product's own name, in the document title.",
  },
];

type Catalog = Readonly<Record<string, unknown>>;

/** Every leaf message, keyed by its dotted path. */
function flatten(catalog: Catalog, prefix = ""): Map<string, string> {
  const leaves = new Map<string, string>();

  for (const [key, value] of Object.entries(catalog)) {
    const dotted = prefix === "" ? key : `${prefix}.${key}`;
    if (typeof value === "string") {
      leaves.set(dotted, value);
    } else if (typeof value === "object" && value !== null) {
      for (const [nested, message] of flatten(value as Catalog, dotted)) {
        leaves.set(nested, message);
      }
    }
  }

  return leaves;
}

function readCatalog(root: string, locale: string): Map<string, string> {
  const file = path.join(root, messagesDirectory, `${locale}.json`);
  return flatten(JSON.parse(readFileSync(file, "utf8")) as Catalog);
}

/** The locales this checkout ships a catalog for, reference locale excluded. */
function translationLocales(root: string): string[] {
  const directory = path.join(root, messagesDirectory);
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory)
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => entry.slice(0, -".json".length))
    .filter((locale) => locale !== referenceLocale)
    .sort();
}

/** Keeps a failure message readable when the message it quotes is a paragraph. */
function quote(message: string): string {
  return message.length > 60 ? `${message.slice(0, 57)}…` : message;
}

export function checkTranslationPolicy(
  root: string,
  allowances: readonly TranslationAllowance[] = allowedUntranslated,
): PolicyViolation[] {
  const referenceFile = path.join(
    root,
    messagesDirectory,
    `${referenceLocale}.json`,
  );
  if (!existsSync(referenceFile)) {
    return [
      {
        file: `${messagesDirectory}/${referenceLocale}.json`,
        fix: `Restore the reference catalog, or point ${policyModule} at the locale this product writes its copy in.`,
        problem: `Every translation is compared against ${referenceLocale}.json, and this checkout has none.`,
      },
    ];
  }

  const violations: PolicyViolation[] = [];
  const reference = readCatalog(root, referenceLocale);
  const allowed = new Map(
    allowances.map((allowance) => [
      `${allowance.locale}:${allowance.key}`,
      allowance,
    ]),
  );
  const spent = new Set<string>();

  for (const locale of translationLocales(root)) {
    const catalog = readCatalog(root, locale);

    for (const [key, message] of [...catalog].sort()) {
      if (reference.get(key) !== message) {
        continue;
      }

      const identifier = `${locale}:${key}`;
      spent.add(identifier);
      const allowance = allowed.get(identifier);

      if (allowance === undefined) {
        violations.push({
          file: `${messagesDirectory}/${locale}.json`,
          fix: `Translate it, or — if the two languages genuinely agree — add { key: "${key}", locale: "${locale}", reason: … } to allowedUntranslated in ${policyModule}.`,
          problem: `"${key}" is the ${referenceLocale} text verbatim: "${quote(message)}".`,
        });
        continue;
      }

      if (allowance.reason.trim().length === 0) {
        violations.push({
          file: policyModule,
          fix: "Say why the two languages agree here, or translate the message and drop the entry.",
          problem: `The allowance for "${key}" in ${locale} carries no reason, so nothing tells a reader whether it is a loanword or an oversight.`,
        });
      }
    }
  }

  for (const allowance of allowances) {
    const identifier = `${allowance.locale}:${allowance.key}`;
    if (!spent.has(identifier)) {
      violations.push({
        file: policyModule,
        fix: `Drop its entry from allowedUntranslated in ${policyModule}.`,
        problem: `"${allowance.key}" in ${allowance.locale} is allowed to read as ${referenceLocale} and no longer does. A ratchet only counts if an improvement is recorded.`,
      });
    }
  }

  return violations;
}
