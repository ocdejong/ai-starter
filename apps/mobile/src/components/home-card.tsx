import { spacing } from "@ai-starter/tokens";
import { StyleSheet, Text, View } from "react-native";
import { useTranslations } from "use-intl";

import { useTheme } from "../theme/theme-provider";

export function HomeCard({ message }: { message: string }) {
  const t = useTranslations("mobile");
  const { theme } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.card }]}>
      <Text style={[styles.title, { color: theme.foreground }]}>
        {t("homeTitle")}
      </Text>
      <Text style={[styles.body, { color: theme["muted-foreground"] }]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: spacing.md,
    gap: spacing.sm,
    padding: spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
});
