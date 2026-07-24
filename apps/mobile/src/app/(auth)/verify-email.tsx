import { useLocalSearchParams, useRouter } from "expo-router";

import { verifyEmailState } from "../../auth/verify-email";
import { VerifyEmailNotice } from "../../components/auth/verify-email-notice";

/**
 * Reached twice in the flow: right after sign-up (`sent=1`, carrying the address
 * so the link can be resent) and again from the emailed link, which Better Auth
 * redirects here once it has verified the address.
 */
export default function VerifyEmailScreen() {
  const router = useRouter();
  const { email, error, sent } = useLocalSearchParams<{
    email?: string;
    error?: string;
    sent?: string;
  }>();

  return (
    <VerifyEmailNotice
      email={email}
      onSignIn={() => router.replace("/sign-in")}
      state={verifyEmailState({ error, sent })}
    />
  );
}
