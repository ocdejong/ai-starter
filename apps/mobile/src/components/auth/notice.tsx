import { spacing } from "@ai-starter/tokens";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../theme/theme-provider";

export type NoticeTone = "error" | "info";

/**
 * The one place an account screen tells the reader what happened. `alert` role
 * makes assistive technology announce it when it appears, which matters because
 * the message replaces what the reader just tried to do.
 */
export function Notice({
  message,
  tone,
}: {
  message: string;
  tone: NoticeTone;
}) {
  const { theme } = useTheme();
  const color = tone === "error" ? theme.destructive : theme.foreground;

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.notice,
        { backgroundColor: theme.muted, borderColor: color },
      ]}
    >
      <Text style={[styles.message, { color }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    borderRadius: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
  },
});
