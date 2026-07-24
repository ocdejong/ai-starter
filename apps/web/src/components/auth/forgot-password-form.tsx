"use client";

import {
  requestPasswordResetInputSchema,
  type RequestPasswordResetInput,
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
 * Where the emailed link sends the visitor back to. The auth server validates
 * the token on its own endpoint first and then redirects here with `?token=`,
 * so this is a page, not the endpoint that does the work.
 */
export const resetPasswordRedirectTo = "/reset-password";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [formError, setFormError] = useState<AuthFormErrorCode | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<RequestPasswordResetInput>({
    defaultValues: { email: "" },
    resolver: zodResolver(requestPasswordResetInputSchema),
  });

  if (sentTo !== null) {
    return (
      <div className="space-y-6">
        {/* Worded as a conditional on purpose: the auth server answers the same
            way for a registered and an unregistered address, and so must we. */}
        <AuthHeader
          description={t("forgotPassword.sent", { email: sentTo })}
          title={t("forgotPassword.sentTitle")}
        />
        <Link
          className="text-primary text-sm underline-offset-4 hover:underline"
          href="/sign-in"
        >
          {t("forgotPassword.backToSignIn")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AuthHeader
        description={t("forgotPassword.description")}
        title={t("forgotPassword.title")}
      />
      <form
        className="space-y-4"
        noValidate
        onSubmit={handleSubmit(async ({ email }) => {
          setFormError(null);
          const { error } = await authClient.requestPasswordReset({
            email,
            redirectTo: resetPasswordRedirectTo,
          });

          // An unknown address still answers 200, so an error here is a real
          // failure and promising a link we did not send would be a lie.
          if (error) {
            setFormError("unexpected");
            return;
          }
          setSentTo(email);
        })}
      >
        <AuthField
          autoComplete="email"
          error={errors.email?.message}
          id="email"
          label={t("fields.email")}
          registration={register("email")}
          type="email"
        />
        <FormError code={formError} />
        <Button className="w-full" disabled={isSubmitting} type="submit">
          {isSubmitting
            ? t("forgotPassword.submitting")
            : t("forgotPassword.submit")}
        </Button>
      </form>
      <Link
        className="text-primary text-sm underline-offset-4 hover:underline"
        href="/sign-in"
      >
        {t("forgotPassword.backToSignIn")}
      </Link>
    </div>
  );
}
