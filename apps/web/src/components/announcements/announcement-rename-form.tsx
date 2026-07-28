"use client";

import {
  createAnnouncementInputSchema,
  type CreateAnnouncementInput,
} from "@ai-starter/domain";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { useForm } from "react-hook-form";

import { AnnouncementFieldError } from "~/components/announcements/announcement-field-error";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

/**
 * Renames one announcement.
 *
 * The field is seeded from a prop, which is exactly the shape that goes stale:
 * `useForm` reads `defaultValues` once, so a second announcement arriving in the
 * same mounted form would still show the first one's title. The caller keys this
 * component by the announcement's id, and the test below re-renders it with a
 * different one — a form seeded from a prop needs both.
 */
export function AnnouncementRenameForm({
  isSaving,
  onRename,
  saved,
  title,
}: {
  readonly isSaving: boolean;
  readonly onRename: (title: string) => void;
  readonly saved: boolean;
  readonly title: string;
}) {
  const t = useTranslations("app.announcements.rename");
  // A shape that lists several records renders one of these per record, so the
  // field is identified per instance rather than per feature.
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<CreateAnnouncementInput>({
    defaultValues: { title },
    resolver: zodResolver(createAnnouncementInputSchema),
  });

  return (
    <form
      className="space-y-3"
      noValidate
      onSubmit={handleSubmit((input) => {
        onRename(input.title);
      })}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1 space-y-1.5">
          <Label htmlFor={fieldId}>{t("label")}</Label>
          <Input
            {...register("title")}
            aria-describedby={errors.title === undefined ? undefined : errorId}
            aria-invalid={errors.title !== undefined}
            id={fieldId}
          />
        </div>
        <Button disabled={isSaving} type="submit">
          {isSaving ? t("submitting") : t("submit")}
        </Button>
      </div>
      <AnnouncementFieldError id={errorId} message={errors.title?.message} />
      {saved ? (
        <p className="text-muted-foreground text-sm" role="status">
          {t("saved")}
        </p>
      ) : null}
    </form>
  );
}
