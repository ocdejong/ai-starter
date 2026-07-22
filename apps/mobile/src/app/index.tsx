import { colors, spacing } from "@t3-test/tokens";
import { StyleSheet, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HomeCard } from "../components/home-card";
import { api } from "../trpc/provider";

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? colors.dark : colors.light;
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
});
