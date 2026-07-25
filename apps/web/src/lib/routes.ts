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
export const settingsPath = "/settings";
export const accountSettingsPath = "/settings/account";
export const groupSettingsPath = "/settings/group";
