import { z } from "zod";

/**
 * The locales this product ships. Adding one is a deliberate act: add the tag
 * here and a matching `messages/<tag>.json`, and the catalog-parity test will
 * hold the new catalog to the same key set as the others.
 */
export const locales = ["en", "nl"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/** The cookie and the device both hand us untrusted strings; parse before trust. */
export const localeSchema = z.enum(locales);

/** Narrows an untrusted value (cookie, header, stored override) to a `Locale`. */
export function parseLocale(value: unknown): Locale | null {
  const result = localeSchema.safeParse(value);
  return result.success ? result.data : null;
}

type WeightedTag = {
  readonly primary: string;
  readonly quality: number;
};

/** Parses one `Accept-Language` entry (`nl-NL;q=0.8`) into its primary subtag. */
function parseEntry(entry: string): WeightedTag | null {
  const [tag, ...parameters] = entry.trim().split(";");
  const primary = tag?.trim().split("-")[0]?.toLowerCase();
  if (primary === undefined || primary.length === 0 || primary === "*") {
    return null;
  }

  const qualityParameter = parameters
    .map((parameter) => /^\s*q=(\d(?:\.\d+)?)\s*$/.exec(parameter))
    .find((match) => match !== null);
  const quality =
    qualityParameter === undefined ? 1 : Number(qualityParameter[1]);

  return { primary, quality };
}

/**
 * Picks the best supported locale from an `Accept-Language` header, honouring
 * q-weights, and falls back to {@link defaultLocale} when nothing matches. Pure:
 * the caller supplies the header string it read from the request.
 */
export function negotiateLocale(
  acceptLanguage: string | null | undefined,
): Locale {
  if (acceptLanguage === null || acceptLanguage === undefined) {
    return defaultLocale;
  }

  const ranked = acceptLanguage
    .split(",")
    .map(parseEntry)
    .filter((tag): tag is WeightedTag => tag !== null)
    .sort((left, right) => right.quality - left.quality);

  for (const { primary } of ranked) {
    const match = locales.find((locale) => locale === primary);
    if (match !== undefined) {
      return match;
    }
  }

  return defaultLocale;
}
