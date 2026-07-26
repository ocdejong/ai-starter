"use client";

import {
  announcementTitlePolicy,
  parseAnnouncementValidationCode,
} from "@ai-starter/domain";
import { useTranslations } from "next-intl";

/**
 * Renders the message for one field of an announcement form.
 *
 * The domain schemas report stable codes because they cannot reach a catalog;
 * this is where a code becomes a sentence. Anything unrecognised falls back to
 * the generic failure rather than leaking an untranslated validation string, and
 * `typecheck` is what proves every code in the union has a key.
 */
export function AnnouncementFieldError({
  id,
  message,
}: {
  readonly id: string;
  readonly message?: string | undefined;
}) {
  const t = useTranslations("app.announcements");

  if (message === undefined) {
    return null;
  }

  const code = parseAnnouncementValidationCode(message);
  const text =
    code === "announcementTitleTooLong"
      ? t("validation.announcementTitleTooLong", {
          max: announcementTitlePolicy.maxLength,
        })
      : code === null
        ? t("errors.unexpected")
        : t(`validation.${code}`);

  return (
    <p className="text-destructive text-sm" id={id} role="alert">
      {text}
    </p>
  );
}
