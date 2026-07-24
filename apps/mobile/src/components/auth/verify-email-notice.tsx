import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";

import { authClient } from "../../auth/client";
import { verifyEmailCallbackPath } from "../../auth/deep-links";
import { authRequestOutcome } from "../../auth/request";
import { type VerifyEmailState } from "../../auth/verify-email";
import { AuthScreen } from "./auth-screen";
import { Notice } from "./notice";
import { SubmitButton } from "./submit-button";
import { TextLink } from "./text-link";

/**
 * The confirmation screen, in its three states.
 *
 * `pending` is where sign-up and a refused unverified sign-in both leave the
 * reader; `confirmed` is where the emailed link lands them once the server has
 * verified the address. Verification signs the *browser* in, never this app — the
 * cookie the server set went to whichever browser opened the link — so even the
 * confirmed state ends at sign-in.
 */
export function VerifyEmailNotice({
  email,
  onSignIn,
  state,
}: {
  email: string | undefined;
  onSignIn: () => void;
  state: VerifyEmailState;
}) {
  const t = useTranslations("auth");
  const tMobile = useTranslations("mobile");
  const [resent, setResent] = useState(false);
  const [failedToResend, setFailedToResend] = useState(false);
  const [pending, setPending] = useState(false);

  async function resend(address: string) {
    setFailedToResend(false);
    setPending(true);
    const failure = await authRequestOutcome(() =>
      authClient.sendVerificationEmail({
        callbackURL: verifyEmailCallbackPath,
        email: address,
      }),
    );
    setPending(false);

    if (failure === null) {
      setResent(true);
      return;
    }

    setFailedToResend(true);
  }

  const title =
    state === "failed"
      ? t("verifyEmail.failedTitle")
      : state === "confirmed"
        ? t("verifyEmail.confirmedTitle")
        : t("verifyEmail.pendingTitle");

  const message =
    state === "failed"
      ? t("verifyEmail.failed")
      : state === "confirmed"
        ? t("verifyEmail.confirmed")
        : email === undefined
          ? `${t("verifyEmail.pending")} ${tMobile("openLinkOnThisDevice")}`
          : `${t("signUp.sent", { email })} ${tMobile("openLinkOnThisDevice")}`;

  return (
    <AuthScreen title={title}>
      <Notice message={message} tone={state === "failed" ? "error" : "info"} />
      {failedToResend ? (
        <Notice message={t("resend.failed")} tone="error" />
      ) : null}
      {resent ? <Notice message={t("resend.sent")} tone="info" /> : null}
      {state === "confirmed" || email === undefined ? null : (
        <SubmitButton
          label={t("resend.action")}
          onPress={() => void resend(email)}
          pending={pending}
          pendingLabel={t("resend.sending")}
        />
      )}
      <View style={styles.links}>
        <TextLink label={t("verifyEmail.backToSignIn")} onPress={onSignIn} />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  links: {
    alignItems: "flex-start",
  },
});
