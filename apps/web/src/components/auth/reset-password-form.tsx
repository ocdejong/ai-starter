"use client";

import {
  resetPasswordInputSchema,
  type ResetPasswordInput,
} from "@ai-starter/domain";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { AuthField } from "~/components/auth/auth-field";
import { AuthHeader } from "~/components/auth/auth-header";
import {
  FormError,
  type AuthFormErrorCode,
} from "~/components/auth/form-error";
import { Button } from "~/components/ui/button";
import { authClient } from "~/server/better-auth/client";

/**
 * The token comes from the query the auth server redirected to after checking
 * that it exists and has not expired. It can still be refused here — it is
 * single-use and the check and the reset are two separate requests.
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth");
  const [formError, setFormError] = useState<AuthFormErrorCode | null>(null);
  const [done, setDone] = useState(false);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<ResetPasswordInput>({
    defaultValues: { confirmPassword: "", password: "" },
    resolver: zodResolver(resetPasswordInputSchema),
  });

  if (done) {
    return (
      <div className="space-y-6">
        <AuthHeader
          description={t("resetPassword.done")}
          title={t("resetPassword.doneTitle")}
        />
        <Link
          className="text-primary text-sm underline-offset-4 hover:underline"
          href="/sign-in"
        >
          {t("resetPassword.signInLink")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AuthHeader
        description={t("resetPassword.description")}
        title={t("resetPassword.title")}
      />
      <form
        className="space-y-4"
        noValidate
        onSubmit={handleSubmit(async ({ password }) => {
          setFormError(null);
          const { error } = await authClient.resetPassword({
            newPassword: password,
            token,
          });

          if (error) {
            setFormError("resetLinkRejected");
            return;
          }
          setDone(true);
        })}
      >
        <AuthField
          autoComplete="new-password"
          error={errors.password?.message}
          id="password"
          label={t("fields.newPassword")}
          registration={register("password")}
          type="password"
        />
        <AuthField
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          id="confirm-password"
          label={t("fields.confirmPassword")}
          registration={register("confirmPassword")}
          type="password"
        />
        <FormError code={formError} />
        <Button className="w-full" disabled={isSubmitting} type="submit">
          {isSubmitting
            ? t("resetPassword.submitting")
            : t("resetPassword.submit")}
        </Button>
      </form>
    </div>
  );
}
