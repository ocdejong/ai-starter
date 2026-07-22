import { type Identity } from "./starter-identity.ts";

export type ProductIdentityInput = {
  readonly name: string;
  readonly scope?: string | undefined;
  readonly applicationId?: string | undefined;
};

/** npm scopes and Expo slugs share this shape: lower-case words joined by single hyphens. */
const slugPattern = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** Reverse-DNS identifier accepted by both the App Store and Android. */
const applicationIdPattern = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

export class IdentityError extends Error {}

export function toSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ensure(condition: boolean, message: string): void {
  if (!condition) {
    throw new IdentityError(message);
  }
}

/**
 * Derives every identifier the initializer needs from the product name plus the
 * two optional overrides. Rejects anything that would produce an invalid package
 * name, an invalid Expo identifier, or a residual-scan false positive.
 */
export function deriveProductIdentity(
  input: ProductIdentityInput,
  starter: Identity,
): Identity {
  const displayName = input.name.trim();
  ensure(displayName.length > 0, "--name must not be empty.");
  ensure(
    !displayName.includes("\n"),
    "--name must be a single line of visible text.",
  );

  const slug = toSlug(displayName);
  ensure(
    slugPattern.test(slug),
    `--name "${displayName}" produces the slug "${slug}", which is not a valid package or Expo identifier. Use letters and digits, starting with a letter.`,
  );

  const scope = input.scope?.trim().replace(/^@/, "") ?? slug;
  ensure(
    slugPattern.test(scope),
    `--scope "${scope}" is not a valid npm scope. Use lower-case words joined by single hyphens, starting with a letter.`,
  );

  const compactSlug = slug.replace(/-/g, "");
  const applicationId =
    input.applicationId?.trim() ?? `com.example.${compactSlug}`;
  ensure(
    applicationIdPattern.test(applicationId),
    `--app-id "${applicationId}" is not a valid reverse-DNS application identifier, for example com.example.${compactSlug}.`,
  );

  const product: Identity = {
    applicationId,
    compactSlug,
    displayName,
    scope,
    slug,
  };

  assertDistinctFromStarter(product, starter);
  return product;
}

/**
 * The rewrite replaces starter tokens with product tokens in a single pass. If a
 * product token still contained a starter token, the residual scan could never
 * be satisfied, so this is rejected up front with a concrete explanation.
 */
function assertDistinctFromStarter(product: Identity, starter: Identity): void {
  const starterTokens = identityTokens(starter);
  for (const [field, value] of Object.entries(product)) {
    for (const token of starterTokens) {
      ensure(
        !value.includes(token),
        `The derived ${field} "${value}" still contains the starter identifier "${token}". Choose a product name, scope or application identifier that does not embed it.`,
      );
    }
  }
}

/**
 * Identity tokens ordered longest first, so a single left-to-right pass always
 * matches the most specific identifier: the application identifier before the
 * compact slug it contains, and the scope before the bare slug.
 */
export function identityTokens(identity: Identity): string[] {
  return [
    identity.applicationId,
    `@${identity.scope}/`,
    identity.slug,
    identity.compactSlug,
    identity.displayName,
  ].sort((left, right) => right.length - left.length);
}
