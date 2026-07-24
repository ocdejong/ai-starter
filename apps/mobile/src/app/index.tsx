import { spacing } from "@ai-starter/tokens";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";

import { HomeCard } from "../components/home-card";
import { LocaleSwitcher } from "../components/locale-switcher";
import { ThemeToggle } from "../components/theme-toggle";
import { useTheme } from "../theme/theme-provider";
import { api } from "../trpc/provider";

export default function HomeScreen() {
  const t = useTranslations("mobile");
  const { theme } = useTheme();
  const hello = api.post.hello.useQuery({ text: "from Expo" });

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
    >
      <HomeCard
        message={
          hello.data?.greeting ??
          (hello.isError ? t("apiUnavailable") : t("apiConnecting"))
        }
      />
      <LocaleSwitcher />
      <ThemeToggle />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    gap: spacing.lg,
    justifyContent: "center",
    padding: spacing.lg,
  },
});
