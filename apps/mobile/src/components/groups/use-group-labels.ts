import {
  groupNamePolicy,
  type GroupErrorCode,
  type GroupRole,
  type GroupValidationCode,
} from "@ai-starter/domain";
import { useTranslations } from "use-intl";

/**
 * Names a role in the reader's language. A role this application does not
 * assign — Better Auth stores them comma-separated, so a membership could carry
 * several — is named as unknown rather than guessed at.
 */
export function useRoleLabel(): (role: GroupRole | null) => string {
  const t = useTranslations("app.settings.groups.roles");

  return (role) => (role === null ? t("unknown") : t(role));
}

/** Turns a refused group action into the sentence shown for it. */
export function useGroupErrorMessage(): (
  code: GroupErrorCode | null,
) => string | null {
  const t = useTranslations("app.settings.groups.errors");

  return (code) => (code === null ? null : t(code));
}

/**
 * Turns a field's validation code into its message. A code this build does not
 * recognise is still a real failure, so it reports the generic message rather
 * than passing silently.
 */
export function useGroupFieldError(): (
  code: GroupValidationCode | null | undefined,
) => string | undefined {
  const t = useTranslations("app.settings.groups");

  return (code) => {
    if (code === undefined) {
      return undefined;
    }
    return code === null
      ? t("errors.unexpected")
      : t(`validation.${code}`, { max: groupNamePolicy.maxLength });
  };
}
