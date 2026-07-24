import { spacing } from "@ai-starter/tokens";
import { type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../../theme/theme-provider";

/**
 * The frame every account screen shares: a heading, an optional explanation and
 * the form. It scrolls so the fields stay reachable once the keyboard is up, and
 * takes its colors from the theme context rather than any literal.
 */
export function AuthScreen({
  children,
  subtitle,
  title,
}: {
  children: ReactNode;
  subtitle?: string | undefined;
  title: string;
}) {
  const { theme } = useTheme();

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: theme.foreground }]}
          >
            {title}
          </Text>
          {subtitle === undefined ? null : (
            <Text
              style={[styles.subtitle, { color: theme["muted-foreground"] }]}
            >
              {subtitle}
            </Text>
          )}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    gap: spacing.lg,
    justifyContent: "center",
    padding: spacing.lg,
  },
  header: {
    gap: spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
});
