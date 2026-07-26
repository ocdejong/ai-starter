"use client";

import {
  publishAnnouncementInputSchema,
  type PublishAnnouncementInput,
} from "@ai-starter/domain";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";

import { AnnouncementFieldError } from "~/components/announcements/announcement-field-error";
import { AnnouncementRenameForm } from "~/components/announcements/announcement-rename-form";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import type { RouterOutputs } from "~/trpc/react";

/**
 * The record the interface renders, derived from what the procedure returns
 * rather than restated — a narrower projection upstream becomes a type error
 * here instead of an empty element.
 */
export type Announcement = RouterOutputs["announcement"]["list"][number];

/** The two outcomes a reader can act on differently. */
export type AnnouncementFailure = "network" | "unexpected";

/**
 * Everything the announcements screen shows, given the data.
 *
 * It takes records and callbacks rather than reaching for the API itself, so the
 * transport lives in one place above it and this stays provable without one.
 */
export function AnnouncementPanel({
  announcements,
  failure,
  isPublishing,
  isRenaming,
  onPublish,
  onRename,
  renameSaved,
}: {
  readonly announcements: readonly Announcement[];
  readonly failure: AnnouncementFailure | null;
  readonly isPublishing: boolean;
  readonly isRenaming: boolean;
  readonly onPublish: (title: string) => void;
  readonly onRename: (input: { announcementId: string; title: string }) => void;
  readonly renameSaved: boolean;
}) {
  const t = useTranslations("app.announcements");
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<PublishAnnouncementInput>({
    defaultValues: { title: "" },
    resolver: zodResolver(publishAnnouncementInputSchema),
  });

  const current = announcements.find((entry) => entry.isCurrent) ?? null;
  const earlier = announcements.filter((entry) => !entry.isCurrent);

  return (
    <div className="space-y-8">
      <p className="text-muted-foreground text-sm">
        {t("count", { count: announcements.length })}
      </p>

      {failure === null ? null : (
        <p
          className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm"
          role="alert"
        >
          {t(`errors.${failure}`)}
        </p>
      )}

      <section aria-labelledby="announcement-current" className="space-y-3">
        <h2 className="text-lg font-semibold" id="announcement-current">
          {t("current.title")}
        </h2>
        {current === null ? (
          <p className="text-muted-foreground text-sm">{t("current.empty")}</p>
        ) : (
          // Keyed by the announcement it is about. The form reads its default
          // value once, so without this a newly published announcement would
          // leave the previous title sitting in the field — every unit test
          // passes while that is broken, because each renders it only once.
          <AnnouncementRenameForm
            isSaving={isRenaming}
            key={current.id}
            onRename={(title) => {
              onRename({ announcementId: current.id, title });
            }}
            saved={renameSaved}
            title={current.title}
          />
        )}
      </section>

      <section aria-labelledby="announcement-publish" className="space-y-3">
        <h2 className="text-lg font-semibold" id="announcement-publish">
          {t("publish.title")}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t("publish.description")}
        </p>
        <form
          className="space-y-3"
          noValidate
          onSubmit={handleSubmit((input) => {
            onPublish(input.title);
          })}
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1 space-y-1.5">
              <Label htmlFor="announcement-title">{t("publish.label")}</Label>
              <Input
                {...register("title")}
                aria-describedby={
                  errors.title === undefined
                    ? undefined
                    : "announcement-title-error"
                }
                aria-invalid={errors.title !== undefined}
                id="announcement-title"
              />
            </div>
            <Button disabled={isPublishing} type="submit">
              {isPublishing ? t("publish.submitting") : t("publish.submit")}
            </Button>
          </div>
          <AnnouncementFieldError
            id="announcement-title-error"
            message={errors.title?.message}
          />
        </form>
      </section>

      <section aria-labelledby="announcement-earlier" className="space-y-3">
        <h2 className="text-lg font-semibold" id="announcement-earlier">
          {t("earlier.title")}
        </h2>
        {earlier.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("earlier.empty")}</p>
        ) : (
          <ul className="divide-border divide-y">
            {earlier.map((entry) => (
              <li className="py-2" key={entry.id}>
                {entry.title}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
