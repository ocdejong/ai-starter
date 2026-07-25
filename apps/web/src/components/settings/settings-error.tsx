"use client";

import { useTranslations } from "next-intl";

/**
 * The failures an account-settings form can report, as keys under
 * `app.settings.errors`.
 *
 * These are deliberately more specific than the codes the signed-out forms may
 * use: whoever is reading this page has already proved who they are, so naming
 * the wrong password tells them how to succeed without telling a stranger
 * anything. Nothing here may become finer-grained than what the auth server
 * actually answers.
 */
export type SettingsErrorCode = "incorrectPassword" | "network" | "unexpected";

const codesByServerCode: Readonly<Record<string, SettingsErrorCode>> = {
  INVALID_PASSWORD: "incorrectPassword",
};

/**
 * Runs one auth-client call and reduces whatever went wrong to a code this page
 * can translate, or `null` when it succeeded.
 *
 * The client reports a server answer as `{ error }` but *throws* when the
 * request never completes, and every form needs both handled — so the branch
 * lives here once. A thrown error means the API was unreachable rather than that
 * the request was refused, which is a different thing to tell someone.
 */
export async function settingsRequestOutcome(
  call: () => Promise<{ readonly error?: unknown }>,
): Promise<SettingsErrorCode | null> {
  try {
    const { error } = await call();
    return error === null || error === undefined ? null : classify(error);
  } catch (thrown) {
    return classify(thrown, "network");
  }
}

function classify(
  error: unknown,
  fallback: SettingsErrorCode = "unexpected",
): SettingsErrorCode {
  if (typeof error === "object" && error !== null && "code" in error) {
    const { code } = error as { readonly code: unknown };
    if (typeof code === "string") {
      return codesByServerCode[code] ?? "unexpected";
    }
  }
  return fallback;
}

export function SettingsError({ code }: { code: SettingsErrorCode | null }) {
  const t = useTranslations("app.settings.errors");

  if (code === null) {
    return null;
  }

  return (
    <p
      className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm"
      role="alert"
    >
      {t(code)}
    </p>
  );
}

/** A settled, reassuring outcome — announced, but not as a problem. */
export function SettingsNotice({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="border-border bg-muted text-muted-foreground rounded-lg border px-3 py-2 text-sm"
      role="status"
    >
      {children}
    </p>
  );
}
