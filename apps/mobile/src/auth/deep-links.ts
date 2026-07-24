import * as Linking from "expo-linking";

/**
 * Where the verification email returns to. It stays relative: the Expo auth
 * client expands a leading "/" in a `callbackURL` body field into a deep link
 * for the app's own scheme, so this must not be pre-expanded.
 */
export const verifyEmailCallbackPath = "/verify-email";

const resetPasswordPath = "/reset-password";

/**
 * The absolute deep link the password-reset email returns to.
 *
 * Unlike `callbackURL`, `requestPasswordReset` sends `redirectTo`, which the
 * Expo client does not expand — so it is built here. Better Auth appends the
 * token as a query parameter when it redirects, and the URL must match a
 * trusted origin on the server (the app scheme, registered by the composition
 * root) or the request is refused before any mail is sent.
 */
export function resetPasswordRedirectUrl(): string {
  return Linking.createURL(resetPasswordPath);
}
