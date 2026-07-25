"use client";

import {
  createGroupInputSchema,
  groupErrorFor,
  groupSlug,
  type CreateGroupInput,
  type GroupErrorCode,
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
 * Creates a group and switches to it.
 *
 * Slugs are unique across the whole installation rather than per account, so two
 * people naming a group the same thing would collide; the random suffix is what
 * separates them, and the readable half comes from the name so the identifier
 * still says what it is. Creating a group makes it the active one — that is the
 * auth server's own default, and it is what someone who just made a group
 * expects to be looking at.
 */
export function CreateGroupForm({
  onCreated,
}: {
  readonly onCreated: () => void;
}) {
  const t = useTranslations("app.settings.groups.create");
  const [error, setError] = useState<GroupErrorCode | null>(null);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<CreateGroupInput>({
    defaultValues: { name: "" },
    resolver: zodResolver(createGroupInputSchema),
  });

  return (
    <section aria-labelledby="create-group" className="space-y-3">
      <h3 className="text-lg font-medium" id="create-group">
        {t("title")}
      </h3>
      <form
        className="space-y-3"
        noValidate
        onSubmit={handleSubmit(async ({ name }) => {
          setError(null);
          const { error: failure } = await authClient.organization.create({
            name,
            slug: groupSlug(name, crypto.randomUUID().slice(0, 8)),
          });

          if (failure) {
            setError(groupErrorFor(failure.code));
            return;
          }
          reset();
          onCreated();
        })}
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1 space-y-1.5">
            <Label htmlFor="create-group-name">{t("nameLabel")}</Label>
            <Input
              {...register("name")}
              aria-describedby={
                errors.name === undefined ? undefined : "create-group-error"
              }
              aria-invalid={errors.name !== undefined}
              id="create-group-name"
            />
          </div>
          <Button disabled={isSubmitting} type="submit">
            {isSubmitting ? t("submitting") : t("submit")}
          </Button>
        </div>
        <GroupFieldError
          id="create-group-error"
          message={errors.name?.message}
        />
        <GroupError code={error} />
      </form>
    </section>
  );
}
