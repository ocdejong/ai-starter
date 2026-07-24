import { useRouter } from "expo-router";

import { ForgotPasswordForm } from "../../components/auth/forgot-password-form";

export default function ForgotPasswordScreen() {
  const router = useRouter();

  return <ForgotPasswordForm onSignIn={() => router.replace("/sign-in")} />;
}
