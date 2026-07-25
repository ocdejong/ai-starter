"use client";

import { groupNamePolicy, parseGroupValidationCode } from "@ai-starter/domain";
import { useTranslations } from "next-intl";

/**
 * Renders the message for one field of a group form. The domain schemas report
 * stable codes because they cannot reach a catalog; this is where a code becomes
 * a sentence, and anything unrecognised falls back to the generic failure rather
 * than leaking an untranslated string.
 */
export function GroupFieldError({
  id,
  message,
}: {
  readonly id: string;
  readonly message?: string | undefined;
}) {
  const t = useTranslations("app.settings.groups");

  if (message === undefined) {
    return null;
  }

  const code = parseGroupValidationCode(message);
  const text =
    code === "groupNameTooLong"
      ? t("validation.groupNameTooLong", { max: groupNamePolicy.maxLength })
      : code === null
        ? t("errors.unexpected")
        : t(`validation.${code}`);

  return (
    <p className="text-destructive text-sm" id={id} role="alert">
      {text}
    </p>
  );
}
