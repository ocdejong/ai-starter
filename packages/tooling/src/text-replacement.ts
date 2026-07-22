import { type Identity } from "./starter-identity.ts";
import { identityTokens } from "./product-identity.ts";

export type Replacement = {
  readonly from: string;
  readonly to: string;
};

export type Occurrence = {
  readonly token: string;
  readonly line: number;
  readonly column: number;
};

/**
 * Maps every starter token onto its product counterpart, longest source token
 * first so `applyReplacements` always matches the most specific identifier.
 */
export function buildIdentityReplacements(
  starter: Identity,
  product: Identity,
): Replacement[] {
  const byToken = new Map<string, string>([
    [starter.applicationId, product.applicationId],
    [`@${starter.scope}/`, `@${product.scope}/`],
    [starter.slug, product.slug],
    [starter.compactSlug, product.compactSlug],
    [starter.displayName, product.displayName],
  ]);

  return identityTokens(starter)
    .map((from) => ({ from, to: byToken.get(from) ?? from }))
    .filter((replacement) => replacement.from !== replacement.to);
}

/**
 * Replaces every token in one left-to-right pass. A single pass is what makes
 * the rewrite safe: replacement output is never rescanned, so overlapping
 * tokens such as `com.example.aistarter` and `aistarter` cannot compound.
 */
export function applyReplacements(
  content: string,
  replacements: readonly Replacement[],
): string {
  if (replacements.length === 0) {
    return content;
  }

  let result = "";
  let index = 0;

  while (index < content.length) {
    const match = replacements.find((replacement) =>
      content.startsWith(replacement.from, index),
    );

    if (match) {
      result += match.to;
      index += match.from.length;
    } else {
      result += content.charAt(index);
      index += 1;
    }
  }

  return result;
}

/** Reports every remaining token with a one-based line and column for the error output. */
export function findOccurrences(
  content: string,
  tokens: readonly string[],
): Occurrence[] {
  const occurrences: Occurrence[] = [];
  const lines = content.split("\n");

  lines.forEach((lineContent, lineIndex) => {
    for (const token of tokens) {
      let column = lineContent.indexOf(token);
      while (column !== -1) {
        occurrences.push({
          column: column + 1,
          line: lineIndex + 1,
          token,
        });
        column = lineContent.indexOf(token, column + token.length);
      }
    }
  });

  return occurrences;
}
