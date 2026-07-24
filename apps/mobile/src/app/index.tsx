import { spacing } from "@ai-starter/tokens";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HomeCard } from "../components/home-card";
import { ThemeToggle } from "../components/theme-toggle";
import { useTheme } from "../theme/theme-provider";
import { api } from "../trpc/provider";

export default function HomeScreen() {
  const { theme } = useTheme();
  const hello = api.post.hello.useQuery({ text: "from Expo" });

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
    >
      <HomeCard
        message={
          hello.data?.greeting ??
          (hello.isError
            ? "The API is unavailable. Start the web app and check EXPO_PUBLIC_API_URL."
            : "Connecting to the typed API…")
        }
      />
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
