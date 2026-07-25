import { spacing } from "@ai-starter/tokens";
import { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../theme/theme-provider";

/**
 * One titled block of the account section. Native has no header chrome to hang
 * these off, so each block states what it is and what it will do before it asks
 * for anything.
 */
export function SettingsBlock({
  children,
  description,
  title,
  tone = "default",
}: {
  children: ReactNode;
  description: string;
  title: string;
  tone?: "default" | "danger";
}) {
  const { theme } = useTheme();
  const accent = tone === "danger" ? theme.destructive : theme.border;

  return (
    <View
      style={[
        styles.block,
        { backgroundColor: theme.card, borderColor: accent },
      ]}
    >
      <Text
        style={[
          styles.title,
          { color: tone === "danger" ? theme.destructive : theme.foreground },
        ]}
      >
        {title}
      </Text>
      <Text style={[styles.description, { color: theme["muted-foreground"] }]}>
        {description}
      </Text>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    borderRadius: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  body: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
});
