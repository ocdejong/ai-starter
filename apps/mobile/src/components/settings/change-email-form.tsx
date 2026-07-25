import { changeEmailInputSchemaFor } from "@ai-starter/domain";
import { spacing } from "@ai-starter/tokens";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
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
 * Changing the account's address, which takes two links: the first goes to the
 * address on the account and only approves the change, and the second — sent to
 * the new address once the first is opened — is what moves the account.
 *
 * No `callbackURL` is passed. On web both links come back to the settings page;
 * here they open in the phone's browser, where a deep link back into the app
 * would land on a screen that cannot tell the reader anything the next launch
 * will not already show.
 */
export function ChangeEmailForm({ email }: { email: string }) {
  const t = useTranslations("app.settings.email");
  const tErrors = useTranslations("app.settings.errors");
  const [newEmail, setNewEmail] = useState("");
  const [codes, setCodes] = useState(fieldValidationCodes([]));
  const [errorKey, setErrorKey] = useState<SettingsErrorKey | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const fieldError = useFieldError(codes);
  const { theme } = useTheme();
  const schema = useMemo(() => changeEmailInputSchemaFor(email), [email]);

  async function submit() {
    const parsed = schema.safeParse({ newEmail });
    if (!parsed.success) {
      setCodes(fieldValidationCodes(parsed.error.issues));
      setErrorKey(null);
      setSentTo(null);
      return;
    }

    setCodes(fieldValidationCodes([]));
    setErrorKey(null);
    setSentTo(null);
    setPending(true);
    const failure = await settingsOutcome(() =>
      authClient.changeEmail({ newEmail: parsed.data.newEmail }),
    );
    setPending(false);

    if (failure !== null) {
      setErrorKey(failure);
      return;
    }
    setSentTo(parsed.data.newEmail);
    setNewEmail("");
  }

  return (
    <SettingsBlock description={t("description")} title={t("title")}>
      <View style={styles.current}>
        <Text style={[styles.label, { color: theme["muted-foreground"] }]}>
          {t("current")}
        </Text>
        <Text style={[styles.value, { color: theme.foreground }]}>{email}</Text>
      </View>
      <TextField
        autoComplete="email"
        error={fieldError("newEmail")}
        keyboardType="email-address"
        label={t("newEmail")}
        onChangeText={setNewEmail}
        value={newEmail}
      />
      {errorKey === null ? null : (
        <Notice message={tErrors(errorKey)} tone="error" />
      )}
      {sentTo === null ? null : (
        <Notice message={t("sent", { email, newEmail: sentTo })} tone="info" />
      )}
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
  current: {
    gap: spacing.xs,
  },
  label: {
    fontSize: 14,
  },
  value: {
    fontSize: 16,
    fontWeight: "600",
  },
});
