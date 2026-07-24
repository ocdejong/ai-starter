import { spacing } from "@ai-starter/tokens";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";

import { authClient } from "../../auth/client";
import { type AuthErrorKey } from "../../auth/errors";
import { authRequestOutcome } from "../../auth/request";
import { Notice } from "./notice";
import { SubmitButton } from "./submit-button";

/**
 * Who is signed in, and the way out.
 *
 * Signing out clears the keychain entry through the Expo plugin, which is what
 * makes the session gate send the reader back to sign-in — this component does
 * not navigate itself. The authenticated shell is stage 10's work; this is the
 * minimum that proves the loop closes.
 */
export function SessionSummary({ name }: { name: string }) {
  const t = useTranslations("auth");
  const tHome = useTranslations("home");
  const tMobile = useTranslations("mobile");
  const [errorKey, setErrorKey] = useState<AuthErrorKey | null>(null);
  const [pending, setPending] = useState(false);

  async function signOut() {
    setErrorKey(null);
    setPending(true);
    setErrorKey(
      (await authRequestOutcome(() => authClient.signOut()))?.key ?? null,
    );
    setPending(false);
  }

  return (
    <View style={styles.summary}>
      <Notice message={tMobile("signedInAs", { name })} tone="info" />
      {errorKey === null ? null : (
        <Notice message={t(`errors.${errorKey}`)} tone="error" />
      )}
      <SubmitButton
        label={tHome("signOut")}
        onPress={() => void signOut()}
        pending={pending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    gap: spacing.md,
  },
});
