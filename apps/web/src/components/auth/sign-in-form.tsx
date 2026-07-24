"use client";

import { signInInputSchema, type SignInInput } from "@ai-starter/domain";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { AuthField } from "~/components/auth/auth-field";
import { AuthHeader } from "~/components/auth/auth-header";
import {
  FormError,
  type AuthFormErrorCode,
} from "~/components/auth/form-error";
import { ResendVerificationButton } from "~/components/auth/resend-verification-button";
import { Button } from "~/components/ui/button";
import { authClient } from "~/server/better-auth/client";

export function SignInForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [formError, setFormError] = useState<AuthFormErrorCode | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<SignInInput>({
    defaultValues: { email: "", password: "" },
    resolver: zodResolver(signInInputSchema),
  });

  // The auth server refuses an unverified sign-in with 403 and, because
  // `sendOnSignIn` is enabled, has already sent a fresh link by the time we get
  // here — so this panel reports what happened rather than asking again.
  if (unverifiedEmail !== null) {
    return (
      <div className="space-y-6">
        <AuthHeader
          description={t("unverified.description", { email: unverifiedEmail })}
          title={t("unverified.title")}
        />
        <ResendVerificationButton email={unverifiedEmail} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AuthHeader
        description={t("signIn.description")}
        title={t("signIn.title")}
      />
      <form
        className="space-y-4"
        noValidate
        onSubmit={handleSubmit(async ({ email, password }) => {
          setFormError(null);
          const { error } = await authClient.signIn.email({ email, password });

          if (!error) {
            router.push("/");
            router.refresh();
            return;
          }
          if (error.code === "EMAIL_NOT_VERIFIED") {
            setUnverifiedEmail(email);
            return;
          }
          setFormError(
            error.code === "INVALID_EMAIL_OR_PASSWORD"
              ? "invalidCredentials"
              : "unexpected",
          );
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
        <AuthField
          autoComplete="current-password"
          error={errors.password?.message}
          id="password"
          label={t("fields.password")}
          registration={register("password")}
          type="password"
        />
        <FormError code={formError} />
        <Button className="w-full" disabled={isSubmitting} type="submit">
          {isSubmitting ? t("signIn.submitting") : t("signIn.submit")}
        </Button>
      </form>
      <div className="space-y-1 text-sm">
        <Link
          className="text-primary underline-offset-4 hover:underline"
          href="/forgot-password"
        >
          {t("signIn.forgotPassword")}
        </Link>
        <p className="text-muted-foreground">
          {t("signIn.noAccount")}{" "}
          <Link
            className="text-primary underline-offset-4 hover:underline"
            href="/sign-up"
          >
            {t("signIn.createAccount")}
          </Link>
        </p>
      </div>
    </div>
  );
}
