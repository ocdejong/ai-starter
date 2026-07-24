"use client";

import { parseAuthValidationCode, passwordPolicy } from "@ai-starter/domain";
import { useTranslations } from "next-intl";

/**
 * Renders the message for one field. The domain schemas are platform-neutral and
 * cannot reach a message catalog, so they report stable codes and this is where a
 * code becomes text a person can read. Anything the domain does not recognise
 * falls back to the generic failure rather than leaking an untranslated string.
 */
export function FieldError({
  id,
  message,
}: {
  id: string;
  message?: string | undefined;
}) {
  const t = useTranslations("auth");

  if (message === undefined) {
    return null;
  }

  const code = parseAuthValidationCode(message);
  const text =
    code === "passwordTooShort"
      ? t("validation.passwordTooShort", { min: passwordPolicy.minLength })
      : code === "passwordTooLong"
        ? t("validation.passwordTooLong", { max: passwordPolicy.maxLength })
        : code === null
          ? t("errors.unexpected")
          : t(`validation.${code}`);

  return (
    <p className="text-destructive text-sm" id={id} role="alert">
      {text}
    </p>
  );
}
