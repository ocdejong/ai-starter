import { spacing } from "@ai-starter/tokens";
import { ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";

import { authClient } from "../../auth/client";
import { LocaleSwitcher } from "../../components/locale-switcher";
import { AccountSection } from "../../components/settings/account-section";
import { GroupSection } from "../../components/settings/group-section";
import { ThemeToggle } from "../../components/theme-toggle";
import { useTheme } from "../../theme/theme-provider";

export default function SettingsScreen() {
  const t = useTranslations("app.settings");
  const { theme } = useTheme();
  // The session gate keeps signed-out readers off this tab; the account section
  // is still written for a missing session, because the gate corrects the route
  // in an effect, one frame after a sign-out.
  const { data: session } = authClient.useSession();

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.safeArea, { backgroundColor: theme.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: theme.foreground }]}>
          {t("title")}
        </Text>
        <AccountSection
          identity={
            session === null || session === undefined
              ? null
              : {
                  email: session.user.email,
                  name: session.user.name,
                  sessionToken: session.session.token,
                }
          }
        />
        <GroupSection />
        <LocaleSwitcher />
        <ThemeToggle />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    gap: spacing.xl,
    padding: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
});
