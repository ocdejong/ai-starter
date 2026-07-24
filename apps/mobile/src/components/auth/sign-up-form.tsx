import { signUpInputSchema } from "@ai-starter/domain";
import { spacing } from "@ai-starter/tokens";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";

import { authClient } from "../../auth/client";
import { verifyEmailCallbackPath } from "../../auth/deep-links";
import { type AuthErrorKey } from "../../auth/errors";
import { authRequestOutcome, fieldValidationCodes } from "../../auth/request";
import { AuthScreen } from "./auth-screen";
import { Notice } from "./notice";
import { SubmitButton } from "./submit-button";
import { TextField } from "./text-field";
import { TextLink } from "./text-link";
import { useFieldError } from "./use-field-error";

/**
 * Registration. The account exists after this call but cannot sign in yet — the
 * server requires a confirmed address — so the reader is handed to the
 * confirmation screen rather than into the app.
 */
export function SignUpForm({
  onSignIn,
  onVerificationSent,
}: {
  onSignIn: () => void;
  onVerificationSent: (email: string) => void;
}) {
  const t = useTranslations("auth");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [codes, setCodes] = useState(fieldValidationCodes([]));
  const [errorKey, setErrorKey] = useState<AuthErrorKey | null>(null);
  const [pending, setPending] = useState(false);
  const fieldError = useFieldError(codes);

  async function submit() {
    const parsed = signUpInputSchema.safeParse({ email, name, password });
    if (!parsed.success) {
      setCodes(fieldValidationCodes(parsed.error.issues));
      setErrorKey(null);
      return;
    }

    setCodes(fieldValidationCodes([]));
    setErrorKey(null);
    setPending(true);
    const failure = await authRequestOutcome(() =>
      authClient.signUp.email({
        // Relative on purpose: the Expo client expands a leading "/" into a deep
        // link, so the emailed link returns here and not to the website.
        callbackURL: verifyEmailCallbackPath,
        ...parsed.data,
      }),
    );
    setPending(false);

    if (failure === null) {
      onVerificationSent(parsed.data.email);
      return;
    }

    setErrorKey(failure.key);
  }

  return (
    <AuthScreen title={t("signUp.title")} subtitle={t("signUp.description")}>
      {errorKey === null ? null : (
        <Notice message={t(`errors.${errorKey}`)} tone="error" />
      )}
      <View style={styles.fields}>
        <TextField
          autoComplete="name"
          error={fieldError("name")}
          label={t("fields.name")}
          onChangeText={setName}
          value={name}
        />
        <TextField
          autoComplete="email"
          error={fieldError("email")}
          keyboardType="email-address"
          label={t("fields.email")}
          onChangeText={setEmail}
          value={email}
        />
        <TextField
          autoComplete="new-password"
          error={fieldError("password")}
          label={t("fields.password")}
          onChangeText={setPassword}
          secureTextEntry
          value={password}
        />
      </View>
      <SubmitButton
        label={t("signUp.submit")}
        onPress={() => void submit()}
        pending={pending}
        pendingLabel={t("signUp.submitting")}
      />
      <View style={styles.links}>
        <TextLink
          label={`${t("signUp.haveAccount")} ${t("signUp.signInLink")}`}
          onPress={onSignIn}
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
