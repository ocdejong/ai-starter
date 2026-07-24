import { useLocalSearchParams, useRouter } from "expo-router";

import { ResetPasswordForm } from "../../components/auth/reset-password-form";

/**
 * Opened by the emailed reset link. Better Auth validates the token first and
 * then redirects to this deep link with `?token=…`, or `?error=…` when the link
 * has expired or was already used.
 */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const { error, token } = useLocalSearchParams<{
    error?: string;
    token?: string;
  }>();

  return (
    <ResetPasswordForm
      linkError={error}
      onRequestNewLink={() => router.replace("/forgot-password")}
      onSignIn={() => router.replace("/sign-in")}
      token={token}
    />
  );
}
