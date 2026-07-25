import { spacing } from "@ai-starter/tokens";
import { StyleSheet, Text, View } from "react-native";
import { useTranslations } from "use-intl";

import { SessionSummary } from "../auth/session-summary";
import { useTheme } from "../../theme/theme-provider";
import { ChangeEmailForm } from "./change-email-form";
import { ChangePasswordForm } from "./change-password-form";
import { DeleteAccount } from "./delete-account";
import { ProfileForm } from "./profile-form";
import { SessionsList } from "./sessions-list";

/** What the account section needs out of the session, and nothing more. */
export type AccountIdentity = {
  readonly email: string;
  readonly name: string;
  readonly sessionToken: string;
};

/**
 * The account section of the settings tab: who is signed in, the way out, and
 * everything a person can change about their own account.
 *
 * It is written for a missing session as well, because the session gate corrects
 * the route in an effect — this still renders for one frame after a sign-out.
 */
export function AccountSection({
  identity,
}: {
  identity: AccountIdentity | null;
}) {
  const t = useTranslations("app.settings");
  const { theme } = useTheme();

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: theme.foreground }]}>
        {t("account")}
      </Text>
      {identity === null ? (
        <Text style={[styles.body, { color: theme["muted-foreground"] }]}>
          {t("accountEmpty")}
        </Text>
      ) : (
        <>
          <SessionSummary name={identity.name} />
          <ProfileForm name={identity.name} />
          <ChangeEmailForm email={identity.email} />
          <ChangePasswordForm />
          <SessionsList currentToken={identity.sessionToken} />
          <DeleteAccount email={identity.email} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  heading: {
    fontSize: 20,
    fontWeight: "700",
  },
  body: {
    fontSize: 14,
  },
});
