"use client";

import {
  changePasswordInputSchema,
  type ChangePasswordInput,
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
 * Replacing the password, with signing the other devices out offered as an
 * explicit choice rather than a silent consequence.
 *
 * Asking for it ends every session the account has, this one included, and the
 * auth server issues a replacement in the same response — the browser follows
 * that cookie, so the reader stays where they are while everyone else is turned
 * out. The session list on this page is stale either way once the change lands.
 */
export function ChangePasswordForm() {
  const t = useTranslations("app.settings.password");
  const tFields = useTranslations("auth.fields");
  const router = useRouter();
  const [error, setError] = useState<SettingsErrorCode | null>(null);
  const [changed, setChanged] = useState(false);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<ChangePasswordInput>({
    defaultValues: {
      confirmPassword: "",
      currentPassword: "",
      newPassword: "",
      revokeOtherSessions: false,
    },
    resolver: zodResolver(changePasswordInputSchema),
  });

  return (
    <SettingsSection
      description={t("description")}
      id="password-settings"
      title={t("title")}
    >
      <form
        className="space-y-4"
        noValidate
        onSubmit={handleSubmit(async (values) => {
          setError(null);
          setChanged(false);
          const failure = await settingsRequestOutcome(() =>
            authClient.changePassword({
              currentPassword: values.currentPassword,
              newPassword: values.newPassword,
              revokeOtherSessions: values.revokeOtherSessions,
            }),
          );

          if (failure !== null) {
            setError(failure);
            return;
          }
          setChanged(true);
          // Nothing typed here should outlive the request that used it.
          reset();
          router.refresh();
        })}
      >
        <AuthField
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          id="current-password"
          label={t("current")}
          registration={register("currentPassword")}
          type="password"
        />
        <AuthField
          autoComplete="new-password"
          error={errors.newPassword?.message}
          id="new-password"
          label={tFields("newPassword")}
          registration={register("newPassword")}
          type="password"
        />
        <AuthField
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          id="confirm-new-password"
          label={tFields("confirmPassword")}
          registration={register("confirmPassword")}
          type="password"
        />
        <div className="flex items-start gap-2">
          <input
            className="border-input accent-primary mt-1 size-4 rounded border"
            id="revoke-other-sessions"
            type="checkbox"
            {...register("revokeOtherSessions")}
          />
          <div className="space-y-0.5">
            <label
              className="text-sm font-medium"
              htmlFor="revoke-other-sessions"
            >
              {t("revokeOthers")}
            </label>
            <p className="text-muted-foreground text-sm">
              {t("revokeOthersHint")}
            </p>
          </div>
        </div>
        <SettingsError code={error} />
        {changed ? <SettingsNotice>{t("changed")}</SettingsNotice> : null}
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? t("submitting") : t("submit")}
        </Button>
      </form>
    </SettingsSection>
  );
}
