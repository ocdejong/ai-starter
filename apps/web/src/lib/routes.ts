/**
 * The application's own routes, named once.
 *
 * These strings are the redirect contract between the signed-out and signed-in
 * halves of the application: `requireSession` sends a visitor without an account
 * to `signInPath`, the `(auth)` layout and every auth form send a visitor who
 * has one to `dashboardPath`. A literal in each of those places is a broken link
 * waiting to happen, and a link that only breaks after signing in is exactly the
 * kind of thing a test suite notices late.
 */
export const signInPath = "/sign-in";
export const dashboardPath = "/dashboard";
export const announcementsPath = "/announcements";
export const settingsPath = "/settings";
export const accountSettingsPath = "/settings/account";
export const groupSettingsPath = "/settings/group";

/**
 * Where both halves of an email change come back to.
 *
 * Better Auth carries one `callbackURL` through the whole journey: the link sent
 * to the address on the account redirects here after approving the change, and
 * the link sent to the new address redirects here again after making it. The
 * marker is what lets the account page say the link was accepted — it cannot say
 * which of the two it was, so the address the page shows is the answer.
 */
export const emailChangeParam = "emailChange";
export const emailChangeConfirmed = "confirmed";
export const emailChangeCallbackPath = `${accountSettingsPath}?${emailChangeParam}=${emailChangeConfirmed}`;
