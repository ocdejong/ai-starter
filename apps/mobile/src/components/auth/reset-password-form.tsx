import { resetPasswordInputSchema } from "@ai-starter/domain";
import { spacing } from "@ai-starter/tokens";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";

import { authClient } from "../../auth/client";
import { type AuthErrorKey } from "../../auth/errors";
import { authRequestOutcome, fieldValidationCodes } from "../../auth/request";
import { AuthScreen } from "./auth-screen";
import { Notice } from "./notice";
import { SubmitButton } from "./submit-button";
import { TextField } from "./text-field";
import { TextLink } from "./text-link";
import { useFieldError } from "./use-field-error";

/**
 * Choosing a new password, reached from the emailed link.
 *
 * The token arrives in the deep link's query string; Better Auth redirects there
 * with `?error=…` instead when the link has expired or was already used. Either
 * way the reader is offered a new link rather than a dead form.
 */
export function ResetPasswordForm({
  linkError,
  onRequestNewLink,
  onSignIn,
  token,
}: {
  linkError: string | undefined;
  onRequestNewLink: () => void;
  onSignIn: () => void;
  token: string | undefined;
}) {
  const t = useTranslations("auth");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [codes, setCodes] = useState(fieldValidationCodes([]));
  const [errorKey, setErrorKey] = useState<AuthErrorKey | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const fieldError = useFieldError(codes);

  const usableToken = linkError === undefined ? token : undefined;

  async function submit(resetToken: string) {
    const parsed = resetPasswordInputSchema.safeParse({
      confirmPassword,
      password,
    });
    if (!parsed.success) {
      setCodes(fieldValidationCodes(parsed.error.issues));
      setErrorKey(null);
      return;
    }

    setCodes(fieldValidationCodes([]));
    setErrorKey(null);
    setPending(true);
    const failure = await authRequestOutcome(() =>
      authClient.resetPassword({
        newPassword: parsed.data.password,
        token: resetToken,
      }),
    );
    setPending(false);

    if (failure === null) {
      setSaved(true);
      return;
    }

    setErrorKey(failure.key);
  }

  if (usableToken === undefined) {
    return (
      <AuthScreen title={t("resetPassword.invalidTitle")}>
        <Notice message={t("resetPassword.invalid")} tone="error" />
        <View style={styles.links}>
          <TextLink
            label={t("resetPassword.requestNew")}
            onPress={onRequestNewLink}
          />
          <TextLink label={t("verifyEmail.backToSignIn")} onPress={onSignIn} />
        </View>
      </AuthScreen>
    );
  }

  if (saved) {
    return (
      <AuthScreen title={t("resetPassword.doneTitle")}>
        <Notice message={t("resetPassword.done")} tone="info" />
        <View style={styles.links}>
          <TextLink label={t("resetPassword.signInLink")} onPress={onSignIn} />
        </View>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title={t("resetPassword.title")}
      subtitle={t("resetPassword.description")}
    >
      {errorKey === null ? null : (
        <Notice message={t(`errors.${errorKey}`)} tone="error" />
      )}
      <View style={styles.fields}>
        <TextField
          autoComplete="new-password"
          error={fieldError("password")}
          label={t("fields.newPassword")}
          onChangeText={setPassword}
          secureTextEntry
          value={password}
        />
        <TextField
          autoComplete="new-password"
          error={fieldError("confirmPassword")}
          label={t("fields.confirmPassword")}
          onChangeText={setConfirmPassword}
          secureTextEntry
          value={confirmPassword}
        />
      </View>
      <SubmitButton
        label={t("resetPassword.submit")}
        onPress={() => void submit(usableToken)}
        pending={pending}
        pendingLabel={t("resetPassword.submitting")}
      />
      <View style={styles.links}>
        <TextLink label={t("verifyEmail.backToSignIn")} onPress={onSignIn} />
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
