import { colors, spacing } from "@ai-starter/tokens";
import { StyleSheet, Text, useColorScheme, View } from "react-native";

export function HomeCard({ message }: { message: string }) {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? colors.dark : colors.light;

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <Text style={[styles.title, { color: theme.text }]}>
        AI Starter mobile
      </Text>
      <Text style={[styles.body, { color: theme.textMuted }]}>{message}</Text>
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
