"use client";

import {
  groupErrorFor,
  renameGroupInputSchema,
  type GroupErrorCode,
  type RenameGroupInput,
} from "@ai-starter/domain";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { GroupError } from "~/components/groups/group-error";
import { GroupFieldError } from "~/components/groups/group-field-error";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { authClient } from "~/server/better-auth/client";

/**
 * Renames the active group, for whoever may.
 *
 * A reader who may not rename it sees the name and the reason rather than a
 * disabled field: a control that cannot be used is a worse answer than a
 * sentence explaining why.
 */
export function GroupNameForm({
  canRename,
  name,
  onChanged,
}: {
  readonly canRename: boolean;
  readonly name: string;
  readonly onChanged: () => void;
}) {
  const t = useTranslations("app.settings.groups.current");
  const [error, setError] = useState<GroupErrorCode | null>(null);
  const [saved, setSaved] = useState(false);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<RenameGroupInput>({
    defaultValues: { name },
    resolver: zodResolver(renameGroupInputSchema),
  });

  if (!canRename) {
    return (
      <section aria-labelledby="group-name" className="space-y-2">
        <h3 className="text-lg font-medium" id="group-name">
          {t("title")}
        </h3>
        <p className="text-base">{name}</p>
        <p className="text-muted-foreground text-sm">{t("readOnly")}</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="group-name" className="space-y-3">
      <h3 className="text-lg font-medium" id="group-name">
        {t("title")}
      </h3>
      <form
        className="space-y-3"
        noValidate
        onSubmit={handleSubmit(async (input) => {
          setError(null);
          setSaved(false);
          const { error: failure } = await authClient.organization.update({
            data: { name: input.name },
          });

          if (failure) {
            setError(groupErrorFor(failure.code));
            return;
          }
          setSaved(true);
          onChanged();
        })}
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1 space-y-1.5">
            <Label htmlFor="group-name-input">{t("nameLabel")}</Label>
            <Input
              {...register("name")}
              aria-describedby={
                errors.name === undefined ? undefined : "group-name-error"
              }
              aria-invalid={errors.name !== undefined}
              id="group-name-input"
            />
          </div>
          <Button disabled={isSubmitting} type="submit">
            {isSubmitting ? t("submitting") : t("submit")}
          </Button>
        </div>
        <GroupFieldError id="group-name-error" message={errors.name?.message} />
        <GroupError code={error} />
        {saved ? (
          <p className="text-muted-foreground text-sm" role="status">
            {t("saved")}
          </p>
        ) : null}
      </form>
    </section>
  );
}
