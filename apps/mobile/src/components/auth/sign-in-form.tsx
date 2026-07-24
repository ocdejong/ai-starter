import { signInInputSchema } from "@ai-starter/domain";
import { spacing } from "@ai-starter/tokens";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";

import { authClient } from "../../auth/client";
import { emailNotVerifiedCode, type AuthErrorKey } from "../../auth/errors";
import { authRequestOutcome, fieldValidationCodes } from "../../auth/request";
import { AuthScreen } from "./auth-screen";
import { Notice } from "./notice";
import { SubmitButton } from "./submit-button";
import { TextField } from "./text-field";
import { TextLink } from "./text-link";
import { useFieldError } from "./use-field-error";

/**
 * Sign-in.
 *
 * Navigation is a prop rather than a router call, so the screen file owns routing
 * and this component's behaviour — validation, error mapping, the unverified
 * hand-off — is provable without a navigator. A successful sign-in needs no
 * navigation at all: the root layout's session gate reacts to the new session.
 */
export function SignInForm({
  onCreateAccount,
  onForgotPassword,
  onNeedsVerification,
}: {
  onCreateAccount: () => void;
  onForgotPassword: () => void;
  onNeedsVerification: (email: string) => void;
}) {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [codes, setCodes] = useState(fieldValidationCodes([]));
  const [errorKey, setErrorKey] = useState<AuthErrorKey | null>(null);
  const [pending, setPending] = useState(false);
  const fieldError = useFieldError(codes);

  async function submit() {
    const parsed = signInInputSchema.safeParse({ email, password });
    if (!parsed.success) {
      setCodes(fieldValidationCodes(parsed.error.issues));
      setErrorKey(null);
      return;
    }

    setCodes(fieldValidationCodes([]));
    setErrorKey(null);
    setPending(true);
    const failure = await authRequestOutcome(() =>
      authClient.signIn.email(parsed.data),
    );
    setPending(false);

    // The server has already sent a fresh link by the time it refuses an
    // unverified account, so the confirmation screen is where the reader can act.
    if (failure?.code === emailNotVerifiedCode) {
      onNeedsVerification(parsed.data.email);
      return;
    }

    setErrorKey(failure?.key ?? null);
  }

  return (
    <AuthScreen title={t("signIn.title")} subtitle={t("signIn.description")}>
      {errorKey === null ? null : (
        <Notice message={t(`errors.${errorKey}`)} tone="error" />
      )}
      <View style={styles.fields}>
        <TextField
          autoComplete="email"
          error={fieldError("email")}
          keyboardType="email-address"
          label={t("fields.email")}
          onChangeText={setEmail}
          value={email}
        />
        <TextField
          autoComplete="current-password"
          error={fieldError("password")}
          label={t("fields.password")}
          onChangeText={setPassword}
          secureTextEntry
          value={password}
        />
      </View>
      <SubmitButton
        label={t("signIn.submit")}
        onPress={() => void submit()}
        pending={pending}
        pendingLabel={t("signIn.submitting")}
      />
      <View style={styles.links}>
        <TextLink
          label={t("signIn.forgotPassword")}
          onPress={onForgotPassword}
        />
        <TextLink
          label={`${t("signIn.noAccount")} ${t("signIn.createAccount")}`}
          onPress={onCreateAccount}
        />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  fields: {
    gap: spacing.md,
  },
  links: {
    alignItems: "flex-start",
  },
});
