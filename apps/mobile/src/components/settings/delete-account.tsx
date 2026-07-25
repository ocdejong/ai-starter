import { spacing } from "@ai-starter/tokens";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslations } from "use-intl";

import { authClient } from "../../auth/client";
import { useTheme } from "../../theme/theme-provider";
import { Notice } from "../auth/notice";
import { TextField } from "../auth/text-field";
import { SettingsBlock } from "./settings-block";
import { settingsOutcome, type SettingsErrorKey } from "./settings-failure";

/**
 * Deleting the account — which this screen can only ever *ask* for.
 *
 * The auth server answers a deletion request with an emailed link and deletes
 * nothing until that link is opened, and completing it needs a *browser* session
 * for the account: the link is an ordinary web URL, while this app's session
 * lives in the keychain where the phone's browser cannot see it. So the
 * confirmation says where the link has to be opened rather than implying the app
 * will finish the job. Nothing is deleted here under any circumstances.
 */
export function DeleteAccount({ email }: { email: string }) {
  const t = useTranslations("app.settings.danger");
  const tErrors = useTranslations("app.settings.errors");
  const { theme } = useTheme();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [errorKey, setErrorKey] = useState<SettingsErrorKey | null>(null);
  const [requested, setRequested] = useState(false);
  const [pending, setPending] = useState(false);
  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  async function request() {
    setErrorKey(null);
    setPending(true);
    const failure = await settingsOutcome(() =>
      authClient.deleteUser({ callbackURL: "/" }),
    );
    setPending(false);

    if (failure !== null) {
      setErrorKey(failure);
      return;
    }
    setConfirming(false);
    setTyped("");
    setRequested(true);
  }

  return (
    <SettingsBlock
      description={t("description")}
      title={t("title")}
      tone="danger"
    >
      {requested ? (
        <>
          <Notice message={t("sent", { email })} tone="info" />
          <Notice message={t("webOnly")} tone="info" />
        </>
      ) : null}
      {errorKey === null ? null : (
        <Notice message={tErrors(errorKey)} tone="error" />
      )}
      {confirming ? (
        <View style={styles.confirmation}>
          <Text
            style={[styles.instruction, { color: theme["muted-foreground"] }]}
          >
            {t("confirmInstruction", { email })}
          </Text>
          <TextField
            autoComplete="email"
            keyboardType="email-address"
            label={t("confirmLabel")}
            onChangeText={setTyped}
            value={typed}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !matches || pending }}
            disabled={!matches || pending}
            onPress={() => void request()}
            style={[
              styles.action,
              {
                backgroundColor: theme.destructive,
                opacity: !matches || pending ? 0.5 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.actionLabel,
                { color: theme["primary-foreground"] },
              ]}
            >
              {pending ? t("confirming") : t("confirm")}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setConfirming(false);
              setTyped("");
              setErrorKey(null);
            }}
            style={[
              styles.action,
              { borderColor: theme.border, borderWidth: 1 },
            ]}
          >
            <Text style={[styles.actionLabel, { color: theme.foreground }]}>
              {t("cancel")}
            </Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setRequested(false);
            setConfirming(true);
          }}
          style={[
            styles.action,
            { borderColor: theme.destructive, borderWidth: 1 },
          ]}
        >
          <Text style={[styles.actionLabel, { color: theme.destructive }]}>
            {t("delete")}
          </Text>
        </Pressable>
      )}
    </SettingsBlock>
  );
}

const styles = StyleSheet.create({
  confirmation: {
    gap: spacing.md,
  },
  instruction: {
    fontSize: 14,
    lineHeight: 20,
  },
  action: {
    alignItems: "center",
    borderRadius: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
});
