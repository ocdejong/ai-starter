/**
 * Keys under the `auth.errors` catalog namespace. Every failure the account
 * screens can surface resolves to one of these, so no server message — English
 * only, and sometimes internal — ever reaches a reader.
 */
export type AuthErrorKey =
  "invalidCredentials" | "network" | "resetLinkRejected" | "unexpected";

/**
 * The code Better Auth answers an unverified sign-in with. It is a route change
 * rather than a message: the server has already sent a fresh link, so the reader
 * belongs on the confirmation screen.
 */
export const emailNotVerifiedCode = "EMAIL_NOT_VERIFIED";

/**
 * Better Auth response codes mapped to the message a reader can act on.
 *
 * Several codes collapse onto `invalidCredentials` on purpose: naming which half
 * of the pair was wrong, or whether the address exists at all, is an
 * account-enumeration signal.
 *
 * Password-length codes are absent: `packages/domain`'s policy mirrors the
 * server's bounds, so a request that would trip them never leaves the form.
 */
const keysByCode: Readonly<Record<string, AuthErrorKey>> = {
  CREDENTIAL_ACCOUNT_NOT_FOUND: "invalidCredentials",
  INVALID_EMAIL_OR_PASSWORD: "invalidCredentials",
  INVALID_PASSWORD: "invalidCredentials",
  INVALID_TOKEN: "resetLinkRejected",
  TOKEN_EXPIRED: "resetLinkRejected",
  USER_NOT_FOUND: "invalidCredentials",
};

export function authErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }
  const { code } = error as { readonly code: unknown };
  return typeof code === "string" ? code : undefined;
}

/**
 * Classifies whatever a client call produced. The Better Auth client returns
 * `{ error }` for a server response but *throws* when the request never
 * completes, so both shapes arrive here — and a thrown error means the API was
 * unreachable rather than that the credentials were refused, which matters far
 * more on a phone than in a browser.
 */
export function authErrorKey(error: unknown): AuthErrorKey {
  const code = authErrorCode(error);
  if (code !== undefined) {
    return keysByCode[code] ?? "unexpected";
  }

  return error instanceof Error ? "network" : "unexpected";
}
