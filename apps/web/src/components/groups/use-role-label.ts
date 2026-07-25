"use client";

import { type GroupRole } from "@ai-starter/domain";
import { useTranslations } from "next-intl";

/**
 * Names a role in the reader's language.
 *
 * A role that this application does not assign — Better Auth stores them as a
 * comma-separated string, so a membership could carry several — is named as
 * unknown rather than guessed at or shown raw.
 */
export function useRoleLabel(): (role: GroupRole | null) => string {
  const t = useTranslations("app.settings.groups.roles");

  return (role) => (role === null ? t("unknown") : t(role));
}
