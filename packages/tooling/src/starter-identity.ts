/**
 * The identity that `pnpm starter:init` removes from a downstream product.
 *
 * This module is the single place in the repository that is allowed to contain
 * the starter's literal identifiers. `starter:init` deliberately skips it, so a
 * downstream repository keeps an accurate record of what was replaced and the
 * residual-identity scan keeps a stable reference to compare against.
 */

export type Identity = {
  /** Human-readable product name used in visible text. */
  readonly displayName: string;
  /** Lower-case kebab identifier used for the repository, database and Expo slug. */
  readonly slug: string;
  /** npm scope for workspace packages, written without the leading `@`. */
  readonly scope: string;
  /** Slug without separators, used inside reverse-DNS application identifiers. */
  readonly compactSlug: string;
  /** iOS bundle identifier and Android package name. */
  readonly applicationId: string;
};

export const starterIdentity: Identity = {
  displayName: "AI Starter",
  slug: "ai-starter",
  scope: "ai-starter",
  compactSlug: "aistarter",
  applicationId: "com.example.aistarter",
};

/**
 * Repository-relative path of this module. `starter:init` uses it to exclude
 * itself from both the rewrite and the residual-identity scan.
 */
export const starterIdentityModulePath =
  "packages/tooling/src/starter-identity.ts";
