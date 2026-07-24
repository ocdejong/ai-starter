import { useRouter } from "expo-router";

import { SignUpForm } from "../../components/auth/sign-up-form";

export default function SignUpScreen() {
  const router = useRouter();

  return (
    <SignUpForm
      onSignIn={() => router.replace("/sign-in")}
      onVerificationSent={(email) => {
        // `replace`: the account exists now, so going back to the filled-in form
        // would only invite a duplicate attempt.
        router.replace({
          params: { email, sent: "1" },
          pathname: "/verify-email",
        });
      }}
    />
  );
}
