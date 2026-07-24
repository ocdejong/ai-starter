import { requestPasswordResetInputSchema } from "@ai-starter/domain";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";

import { authClient } from "../../auth/client";
import { resetPasswordRedirectUrl } from "../../auth/deep-links";
import { type AuthErrorKey } from "../../auth/errors";
import { authRequestOutcome, fieldValidationCodes } from "../../auth/request";
import { AuthScreen } from "./auth-screen";
import { Notice } from "./notice";
import { SubmitButton } from "./submit-button";
import { TextField } from "./text-field";
import { TextLink } from "./text-link";
import { useFieldError } from "./use-field-error";

/**
 * Requesting a reset link.
 *
 * The confirmation deliberately does not say whether the address has an account —
 * that answer would let anyone test addresses — so a successful request and an
 * unknown address are indistinguishable here.
 */
export function ForgotPasswordForm({ onSignIn }: { onSignIn: () => void }) {
  const t = useTranslations("auth");
  const tMobile = useTranslations("mobile");
  const [email, setEmail] = useState("");
  const [codes, setCodes] = useState(fieldValidationCodes([]));
  const [errorKey, setErrorKey] = useState<AuthErrorKey | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const fieldError = useFieldError(codes);

  async function submit() {
    const parsed = requestPasswordResetInputSchema.safeParse({ email });
    if (!parsed.success) {
      setCodes(fieldValidationCodes(parsed.error.issues));
      setErrorKey(null);
      return;
    }

    setCodes(fieldValidationCodes([]));
    setErrorKey(null);
    setPending(true);
    const failure = await authRequestOutcome(() =>
      authClient.requestPasswordReset({
        email: parsed.data.email,
        // `redirectTo` is not expanded by the Expo client, so this is the fully
        // built deep link; the server checks it against its trusted origins.
        redirectTo: resetPasswordRedirectUrl(),
      }),
    );
    setPending(false);

    if (failure === null) {
      setSentTo(parsed.data.email);
      return;
    }

    setErrorKey(failure.key);
  }

  return (
    <AuthScreen
      title={
        sentTo === null
          ? t("forgotPassword.title")
          : t("forgotPassword.sentTitle")
      }
      subtitle={sentTo === null ? t("forgotPassword.description") : undefined}
    >
      {errorKey === null ? null : (
        <Notice message={t(`errors.${errorKey}`)} tone="error" />
      )}
      {sentTo === null ? (
        <>
          <TextField
            autoComplete="email"
            error={fieldError("email")}
            keyboardType="email-address"
            label={t("fields.email")}
            onChangeText={setEmail}
            value={email}
          />
          <SubmitButton
            label={t("forgotPassword.submit")}
            onPress={() => void submit()}
            pending={pending}
            pendingLabel={t("forgotPassword.submitting")}
          />
        </>
      ) : (
        <Notice
          message={`${t("forgotPassword.sent", { email: sentTo })} ${tMobile("openLinkOnThisDevice")}`}
          tone="info"
        />
      )}
      <View style={styles.links}>
        <TextLink label={t("forgotPassword.backToSignIn")} onPress={onSignIn} />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  links: {
    alignItems: "flex-start",
  },
});
