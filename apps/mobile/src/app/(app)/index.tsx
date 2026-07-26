import { spacing } from "@ai-starter/tokens";
import { StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";

import { Chat } from "../../components/chat/chat";
import { useTheme } from "../../theme/theme-provider";

export default function DashboardScreen() {
  const t = useTranslations("app.dashboard");
  const { theme } = useTheme();

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.safeArea, { backgroundColor: theme.background }]}
    >
      <Text style={[styles.title, { color: theme.foreground }]}>
        {t("title")}
      </Text>
      <Text style={[styles.description, { color: theme["muted-foreground"] }]}>
        {t("description")}
      </Text>
      <Chat />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
});
