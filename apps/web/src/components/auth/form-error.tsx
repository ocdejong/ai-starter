"use client";

import { useTranslations } from "next-intl";

/**
 * The failures a whole auth form can report, as keys under `auth.errors`. They
 * are deliberately few: the auth server answers with codes chosen not to reveal
 * whether an account exists, and this list must not become finer-grained than
 * the answers it is allowed to give.
 */
export type AuthFormErrorCode =
  "invalidCredentials" | "resetLinkRejected" | "unexpected";

export function FormError({ code }: { code: AuthFormErrorCode | null }) {
  const t = useTranslations("auth.errors");

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
