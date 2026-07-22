import { colors, spacing } from "@t3-test/tokens";
import { StyleSheet, Text, useColorScheme, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "../trpc/provider";

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? colors.dark : colors.light;
  const hello = api.post.hello.useQuery({ text: "from Expo" });

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
    >
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <Text style={[styles.title, { color: theme.text }]}>
          t3-test mobile
        </Text>
        <Text style={[styles.body, { color: theme.textMuted }]}>
          {hello.data?.greeting ??
            (hello.isError
              ? "The API is unavailable. Start the web app and check EXPO_PUBLIC_API_URL."
              : "Connecting to the typed API…")}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
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
