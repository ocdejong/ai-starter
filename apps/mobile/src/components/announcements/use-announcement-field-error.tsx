import {
  announcementTitlePolicy,
  parseAnnouncementValidationCode,
} from "@ai-starter/domain";
import { useTranslations } from "use-intl";

/**
 * Turns a stable validation code into a sentence, the native counterpart of the
 * web's field-error component. The domain reports codes because it cannot reach
 * a catalog; anything unrecognised becomes the generic failure rather than an
 * untranslated validation string.
 */
export function useAnnouncementFieldError(): (
  message: string | null,
) => string | undefined {
  const t = useTranslations("app.announcements");

  return (message) => {
    if (message === null) {
      return undefined;
    }
    const code = parseAnnouncementValidationCode(message);
    if (code === "announcementTitleTooLong") {
      return t("validation.announcementTitleTooLong", {
        max: announcementTitlePolicy.maxLength,
      });
    }
    return code === null ? t("errors.unexpected") : t(`validation.${code}`);
  };
}
