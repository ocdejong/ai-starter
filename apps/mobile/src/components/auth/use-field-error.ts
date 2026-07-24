import { passwordPolicy, type AuthValidationCode } from "@ai-starter/domain";
import { useTranslations } from "use-intl";

/**
 * Turns the validation codes a domain schema reported into the message shown
 * under a field.
 *
 * A field absent from the map is valid. A field present with a code gets that
 * code's catalog message; present with `null` means the schema reported
 * something this build does not recognise, which is still a real failure, so the
 * field is marked with the generic message rather than silently accepted.
 */
export function useFieldError(
  codes: ReadonlyMap<string, AuthValidationCode | null>,
): (field: string) => string | undefined {
  const t = useTranslations("auth");

  return (field) => {
    if (!codes.has(field)) {
      return undefined;
    }

    const code = codes.get(field) ?? null;
    return code === null
      ? t("errors.unexpected")
      : t(`validation.${code}`, {
          max: passwordPolicy.maxLength,
          min: passwordPolicy.minLength,
        });
  };
}
