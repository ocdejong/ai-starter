"use client";

import { signUpInputSchema, type SignUpInput } from "@ai-starter/domain";
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
import {
  ResendVerificationButton,
  verifyEmailCallbackUrl,
} from "~/components/auth/resend-verification-button";
import { Button } from "~/components/ui/button";
import { authClient } from "~/server/better-auth/client";

export function SignUpForm() {
  const t = useTranslations("auth");
  const [formError, setFormError] = useState<AuthFormErrorCode | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<SignUpInput>({
    defaultValues: { email: "", name: "", password: "" },
    resolver: zodResolver(signUpInputSchema),
  });

  // Registering an address that already has an account answers exactly as it
  // does for a new one, so this panel is all we ever learn — and all we may say.
  if (sentTo !== null) {
    return (
      <div className="space-y-6">
        <AuthHeader
          description={t("signUp.sent", { email: sentTo })}
          title={t("signUp.sentTitle")}
        />
        <ResendVerificationButton email={sentTo} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AuthHeader
        description={t("signUp.description")}
        title={t("signUp.title")}
      />
      <form
        className="space-y-4"
        noValidate
        onSubmit={handleSubmit(async ({ email, name, password }) => {
          setFormError(null);
          const { error } = await authClient.signUp.email({
            callbackURL: verifyEmailCallbackUrl,
            email,
            name,
            password,
          });

          if (error) {
            setFormError("unexpected");
            return;
          }
          setSentTo(email);
        })}
      >
        <AuthField
          autoComplete="name"
          error={errors.name?.message}
          id="name"
          label={t("fields.name")}
          registration={register("name")}
        />
        <AuthField
          autoComplete="email"
          error={errors.email?.message}
          id="email"
          label={t("fields.email")}
          registration={register("email")}
          type="email"
        />
        <AuthField
          autoComplete="new-password"
          error={errors.password?.message}
          id="password"
          label={t("fields.password")}
          registration={register("password")}
          type="password"
        />
        <FormError code={formError} />
        <Button className="w-full" disabled={isSubmitting} type="submit">
          {isSubmitting ? t("signUp.submitting") : t("signUp.submit")}
        </Button>
      </form>
      <p className="text-muted-foreground text-sm">
        {t("signUp.haveAccount")}{" "}
        <Link
          className="text-primary underline-offset-4 hover:underline"
          href="/sign-in"
        >
          {t("signUp.signInLink")}
        </Link>
      </p>
    </div>
  );
}
