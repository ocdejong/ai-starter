"use client";

import { type GroupErrorCode } from "@ai-starter/domain";
import { useTranslations } from "next-intl";

/**
 * Reports a refused group action. The domain narrows the auth server's code to
 * one of a few a person can act on, and this is where that becomes a sentence.
 */
export function GroupError({ code }: { readonly code: GroupErrorCode | null }) {
  const t = useTranslations("app.settings.groups.errors");

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
