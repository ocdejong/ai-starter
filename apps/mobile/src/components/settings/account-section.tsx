import { spacing } from "@ai-starter/tokens";
import { StyleSheet, Text, View } from "react-native";
import { useTranslations } from "use-intl";

import { SessionSummary } from "../auth/session-summary";
import { useTheme } from "../../theme/theme-provider";

/**
 * The account section of the settings tab.
 *
 * It carries who is signed in and the way out, because native has no header menu
 * to put them in. The profile, email, password, session and deletion screens land
 * here; this file is that section's whole seam.
 */
export function AccountSection({ name }: { name: string | null }) {
  const t = useTranslations("app.settings");
  const { theme } = useTheme();

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: theme.foreground }]}>
        {t("account")}
      </Text>
      {name === null ? (
        <Text style={[styles.body, { color: theme["muted-foreground"] }]}>
          {t("accountEmpty")}
        </Text>
      ) : (
        <SessionSummary name={name} />
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
