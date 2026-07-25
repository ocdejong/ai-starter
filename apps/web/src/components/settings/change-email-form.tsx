"use client";

import {
  changeEmailInputSchemaFor,
  type ChangeEmailInput,
} from "@ai-starter/domain";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
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
import { emailChangeCallbackPath } from "~/lib/routes";
import { authClient } from "~/server/better-auth/client";

/**
 * Changing the account's address, which Better Auth deliberately makes a
 * two-link journey: the first link goes to the address currently on the account
 * and only approves the change, and the second — sent to the new address once the
 * first is opened — is what actually moves the account. Both land back here, so
 * the page the reader returns to is the one showing which address is in force.
 *
 * An address that already belongs to someone else is answered exactly like one
 * that does not, because the auth server refuses to reveal which is which; the
 * confirmation below therefore promises an email rather than a change.
 */
export function ChangeEmailForm({ email }: { email: string }) {
  const t = useTranslations("app.settings.email");
  const [error, setError] = useState<SettingsErrorCode | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const schema = useMemo(() => changeEmailInputSchemaFor(email), [email]);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<ChangeEmailInput>({
    defaultValues: { newEmail: "" },
    resolver: zodResolver(schema),
  });

  return (
    <SettingsSection
      description={t("description")}
      id="email-settings"
      title={t("title")}
    >
      <p className="text-sm">
        <span className="text-muted-foreground">{t("current")}: </span>
        <span className="font-medium">{email}</span>
      </p>
      <form
        className="space-y-4"
        noValidate
        onSubmit={handleSubmit(async (values) => {
          setError(null);
          setSentTo(null);
          const failure = await settingsRequestOutcome(() =>
            authClient.changeEmail({
              callbackURL: emailChangeCallbackPath,
              newEmail: values.newEmail,
            }),
          );

          if (failure !== null) {
            setError(failure);
            return;
          }
          setSentTo(values.newEmail);
          reset();
        })}
      >
        <AuthField
          autoComplete="email"
          error={errors.newEmail?.message}
          id="new-email"
          label={t("newEmail")}
          registration={register("newEmail")}
          type="email"
        />
        <SettingsError code={error} />
        {sentTo === null ? null : (
          <SettingsNotice>
            {t("sent", { email, newEmail: sentTo })}
          </SettingsNotice>
        )}
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? t("submitting") : t("submit")}
        </Button>
      </form>
    </SettingsSection>
  );
}
