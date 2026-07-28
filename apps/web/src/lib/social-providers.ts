/**
 * Which social sign-in a deployment offers, decided from its credentials alone.
 *
 * The rule lives here rather than in the auth composition root because both
 * sides of it are observable: the server registers a provider with Better Auth,
 * and the landing page renders a button for one of them or a hint for none. A
 * pure function is what lets the branch a deployment does not run — every
 * deployment runs only one — be asserted rather than assumed.
 */

export type SocialProvider = "github" | "google";

export type OAuthCredentials = {
  readonly clientId: string;
  readonly clientSecret: string;
};

/** A provider's credentials, and only when both halves are present: half a pair configures nothing. */
export function oauthCredentials(
  clientId: string | undefined,
  clientSecret: string | undefined,
): OAuthCredentials | undefined {
  return clientId === undefined ||
    clientId === "" ||
    clientSecret === undefined ||
    clientSecret === ""
    ? undefined
    : { clientId, clientSecret };
}

/**
 * The one provider the landing page offers. Google first when both are
 * configured, because a single button has to choose and Google is the wider
 * account base; a product that prefers otherwise changes this order.
 */
export function resolvePrimarySocialProvider(configured: {
  readonly github?: OAuthCredentials | undefined;
  readonly google?: OAuthCredentials | undefined;
}): SocialProvider | null {
  if (configured.google !== undefined) {
    return "google";
  }
  return configured.github === undefined ? null : "github";
}
