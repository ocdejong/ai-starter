"use client";

import {
  updateProfileInputSchema,
  type UpdateProfileInput,
} from "@ai-starter/domain";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { AuthField } from "~/components/auth/auth-field";
import {
  SettingsError,
  SettingsNotice,
  settingsRequestOutcome,
  type SettingsErrorCode,
} from "~/components/settings/settings-error";
import { SettingsSection } from "~/components/settings/settings-section";
import { Button } from "~/components/ui/button";
import { authClient } from "~/server/better-auth/client";

/**
 * The name the account shows. It is the one profile field the schema carries, so
 * this form deliberately stays one field wide rather than growing a shape the
 * product has not asked for.
 */
export function ProfileForm({ name }: { name: string }) {
  const t = useTranslations("app.settings.profile");
  const tFields = useTranslations("auth.fields");
  const router = useRouter();
  const [error, setError] = useState<SettingsErrorCode | null>(null);
  const [saved, setSaved] = useState(false);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<UpdateProfileInput>({
    defaultValues: { name },
    resolver: zodResolver(updateProfileInputSchema),
  });

  return (
    <SettingsSection
      description={t("description")}
      id="profile-settings"
      title={t("title")}
    >
      <form
        className="space-y-4"
        noValidate
        onSubmit={handleSubmit(async (values) => {
          setError(null);
          setSaved(false);
          const failure = await settingsRequestOutcome(() =>
            authClient.updateUser({ name: values.name }),
          );

          if (failure !== null) {
            setError(failure);
            return;
          }
          setSaved(true);
          // The shell's account menu renders the same name from the session.
          router.refresh();
        })}
      >
        <AuthField
          autoComplete="name"
          error={errors.name?.message}
          id="profile-name"
          label={tFields("name")}
          registration={register("name")}
        />
        <SettingsError code={error} />
        {saved ? <SettingsNotice>{t("saved")}</SettingsNotice> : null}
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? t("submitting") : t("submit")}
        </Button>
      </form>
    </SettingsSection>
  );
}
