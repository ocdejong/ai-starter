/**
 * Keys under the `app.settings.errors` catalog namespace.
 *
 * These are allowed to be more specific than the ones the signed-out screens
 * use: whoever reads the account section has already proved who they are, so
 * naming the wrong password helps them without telling a stranger anything.
 */
export type SettingsErrorKey = "incorrectPassword" | "network" | "unexpected";

const keysByCode: Readonly<Record<string, SettingsErrorKey>> = {
  INVALID_PASSWORD: "incorrectPassword",
};

/**
 * Runs one auth-client call and reduces whatever went wrong to a key the account
 * section can translate, or `null` when it succeeded.
 *
 * The client reports a server answer as `{ error }` but *throws* when the request
 * never completes — on a phone that difference is the whole message, so both
 * shapes are handled here rather than in each screen.
 */
export async function settingsOutcome(
  call: () => Promise<{ readonly error?: unknown }>,
): Promise<SettingsErrorKey | null> {
  try {
    const { error } = await call();
    return error === null || error === undefined ? null : classify(error);
  } catch (thrown) {
    return classify(thrown, "network");
  }
}

function classify(
  error: unknown,
  fallback: SettingsErrorKey = "unexpected",
): SettingsErrorKey {
  if (typeof error === "object" && error !== null && "code" in error) {
    const { code } = error as { readonly code: unknown };
    if (typeof code === "string") {
      return keysByCode[code] ?? "unexpected";
    }
  }
  return fallback;
}
