import { publishAnnouncementInputSchema } from "@ai-starter/domain";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { SubmitButton } from "../auth/submit-button";
import { TextField } from "../auth/text-field";
import { useAnnouncementFieldError } from "./use-announcement-field-error";

/**
 * Renames the group's current announcement.
 *
 * `useState` seeds from a prop, which is the shape that goes stale: a second
 * announcement arriving in the same mounted form would still show the first
 * one's title. The caller keys this component by the announcement's id, and the
 * test re-renders it with a different one — a field seeded from a prop needs
 * both.
 */
export function AnnouncementRenameForm({
  isSaving,
  onRename,
  saved,
  title,
}: {
  isSaving: boolean;
  onRename: (title: string) => void;
  saved: boolean;
  title: string;
}) {
  const t = useTranslations("app.announcements.current");
  const [value, setValue] = useState(title);
  const [message, setMessage] = useState<string | null>(null);
  const fieldError = useAnnouncementFieldError();

  function submit(): void {
    const parsed = publishAnnouncementInputSchema.safeParse({ title: value });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? null);
      return;
    }
    setMessage(null);
    onRename(parsed.data.title);
  }

  return (
    <>
      <TextField
        error={fieldError(message)}
        label={t("label")}
        onChangeText={setValue}
        value={value}
      />
      <SubmitButton
        label={saved ? t("saved") : t("submit")}
        onPress={submit}
        pending={isSaving}
        pendingLabel={t("submitting")}
      />
    </>
  );
}
