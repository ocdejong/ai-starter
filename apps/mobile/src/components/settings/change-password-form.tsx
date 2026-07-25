import { changePasswordInputSchema } from "@ai-starter/domain";
import { spacing } from "@ai-starter/tokens";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslations } from "use-intl";

import { authClient } from "../../auth/client";
import { fieldValidationCodes } from "../../auth/request";
import { useTheme } from "../../theme/theme-provider";
import { Notice } from "../auth/notice";
import { SubmitButton } from "../auth/submit-button";
import { TextField } from "../auth/text-field";
import { useFieldError } from "../auth/use-field-error";
import { SettingsBlock } from "./settings-block";
import { settingsOutcome, type SettingsErrorKey } from "./settings-failure";

/**
 * Replacing the password, with signing the other devices out offered as a
 * choice rather than imposed as a consequence.
 *
 * Asking for it ends every session the account has, this one included, and the
 * auth server returns a replacement in the same response — the Expo client
 * stores that cookie, so this device stays signed in while the others are turned
 * out.
 */
export function ChangePasswordForm() {
  const t = useTranslations("app.settings.password");
  const tErrors = useTranslations("app.settings.errors");
  const tFields = useTranslations("auth.fields");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(false);
  const [codes, setCodes] = useState(fieldValidationCodes([]));
  const [errorKey, setErrorKey] = useState<SettingsErrorKey | null>(null);
  const [changed, setChanged] = useState(false);
  const [pending, setPending] = useState(false);
  const fieldError = useFieldError(codes);
  const { theme } = useTheme();

  async function submit() {
    const parsed = changePasswordInputSchema.safeParse({
      confirmPassword,
      currentPassword,
      newPassword,
      revokeOtherSessions,
    });
    if (!parsed.success) {
      setCodes(fieldValidationCodes(parsed.error.issues));
      setErrorKey(null);
      setChanged(false);
      return;
    }

    setCodes(fieldValidationCodes([]));
    setErrorKey(null);
    setChanged(false);
    setPending(true);
    const failure = await settingsOutcome(() =>
      authClient.changePassword({
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        revokeOtherSessions: parsed.data.revokeOtherSessions,
      }),
    );
    setPending(false);

    if (failure !== null) {
      setErrorKey(failure);
      return;
    }
    // Nothing typed here should outlive the request that used it.
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setChanged(true);
  }

  return (
    <SettingsBlock description={t("description")} title={t("title")}>
      <TextField
        autoComplete="current-password"
        error={fieldError("currentPassword")}
        label={t("current")}
        onChangeText={setCurrentPassword}
        secureTextEntry
        value={currentPassword}
      />
      <TextField
        autoComplete="new-password"
        error={fieldError("newPassword")}
        label={tFields("newPassword")}
        onChangeText={setNewPassword}
        secureTextEntry
        value={newPassword}
      />
      <TextField
        autoComplete="new-password"
        error={fieldError("confirmPassword")}
        label={tFields("confirmPassword")}
        onChangeText={setConfirmPassword}
        secureTextEntry
        value={confirmPassword}
      />
      {/*
        A pressable row rather than a `Switch`: the whole row is the target, and
        the checkbox role is what lets assistive technology — and the tests —
        read the choice as made or not made rather than as decoration.
      */}
      <Pressable
        accessibilityLabel={t("revokeOthers")}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: revokeOtherSessions }}
        onPress={() => {
          setRevokeOtherSessions((checked) => !checked);
        }}
        style={styles.choice}
      >
        <View
          style={[
            styles.box,
            {
              backgroundColor: revokeOtherSessions
                ? theme.primary
                : "transparent",
              borderColor: revokeOtherSessions ? theme.primary : theme.input,
            },
          ]}
        />
        <View style={styles.choiceText}>
          <Text style={[styles.choiceLabel, { color: theme.foreground }]}>
            {t("revokeOthers")}
          </Text>
          <Text
            style={[styles.choiceHint, { color: theme["muted-foreground"] }]}
          >
            {t("revokeOthersHint")}
          </Text>
        </View>
      </Pressable>
      {errorKey === null ? null : (
        <Notice message={tErrors(errorKey)} tone="error" />
      )}
      {changed ? <Notice message={t("changed")} tone="info" /> : null}
      <SubmitButton
        label={t("submit")}
        onPress={() => void submit()}
        pending={pending}
        pendingLabel={t("submitting")}
      />
    </SettingsBlock>
  );
}

const styles = StyleSheet.create({
  choice: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
  },
  box: {
    borderRadius: spacing.xs,
    borderWidth: 1,
    height: 20,
    marginTop: 2,
    width: 20,
  },
  choiceText: {
    flex: 1,
    gap: spacing.xs,
  },
  choiceLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  choiceHint: {
    fontSize: 13,
    lineHeight: 18,
  },
});
