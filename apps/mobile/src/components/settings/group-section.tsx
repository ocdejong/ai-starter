import { spacing } from "@ai-starter/tokens";
import { StyleSheet, Text, View } from "react-native";
import { useTranslations } from "use-intl";

import { useTheme } from "../../theme/theme-provider";

/**
 * The group section of the settings tab: the switcher, members, roles and
 * invitations land here, and nothing else has to move for them to.
 */
export function GroupSection() {
  const t = useTranslations("app.settings");
  const { theme } = useTheme();

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: theme.foreground }]}>
        {t("group")}
      </Text>
      <Text style={[styles.body, { color: theme["muted-foreground"] }]}>
        {t("groupEmpty")}
      </Text>
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
