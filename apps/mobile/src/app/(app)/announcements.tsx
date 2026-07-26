import { spacing } from "@ai-starter/tokens";
import { StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";

import { AnnouncementBoard } from "../../components/announcements/announcement-board";
import { useTheme } from "../../theme/theme-provider";

/**
 * The example feature slice on native. Route files stay trivial — expo-router
 * registers every file in this directory as a screen, so anything with a test
 * lives under `src/components`.
 */
export default function AnnouncementsScreen() {
  const t = useTranslations("app.announcements");
  const { theme } = useTheme();

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.safeArea, { backgroundColor: theme.background }]}
    >
      <Text style={[styles.title, { color: theme.foreground }]}>
        {t("title")}
      </Text>
      <AnnouncementBoard />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
});
