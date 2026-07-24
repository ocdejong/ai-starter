import { useRouter } from "expo-router";

import { SignInForm } from "../../components/auth/sign-in-form";

export default function SignInScreen() {
  const router = useRouter();

  return (
    <SignInForm
      onCreateAccount={() => router.push("/sign-up")}
      onForgotPassword={() => router.push("/forgot-password")}
      onNeedsVerification={(email) => {
        router.push({
          params: { email, sent: "1" },
          pathname: "/verify-email",
        });
      }}
    />
  );
}
