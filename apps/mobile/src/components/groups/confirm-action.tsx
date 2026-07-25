import { spacing } from "@ai-starter/tokens";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../theme/theme-provider";

/**
 * A destructive action that asks first.
 *
 * The question replaces the control in place rather than opening a modal: it
 * needs no dismissal handling to stay usable, and the consequence is written
 * next to the thing that causes it.
 */
export function ConfirmAction({
  accessibilityLabel,
  busy,
  busyLabel,
  cancelLabel,
  confirmLabel,
  label,
  onConfirm,
  question,
}: {
  accessibilityLabel?: string | undefined;
  busy: boolean;
  busyLabel: string;
  cancelLabel: string;
  confirmLabel: string;
  label: string;
  onConfirm: () => void;
  question: string;
}) {
  const { theme } = useTheme();
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <Pressable
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityRole="button"
        onPress={() => {
          setAsking(true);
        }}
        style={[styles.button, { borderColor: theme.border }]}
      >
        <Text style={[styles.label, { color: theme.foreground }]}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.confirming}>
      <Text style={[styles.question, { color: theme.foreground }]}>
        {question}
      </Text>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy, disabled: busy }}
          disabled={busy}
          onPress={() => {
            setAsking(false);
            onConfirm();
          }}
          style={[
            styles.button,
            { borderColor: theme.destructive, opacity: busy ? 0.6 : 1 },
          ]}
        >
          <Text style={[styles.label, { color: theme.destructive }]}>
            {busy ? busyLabel : confirmLabel}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setAsking(false);
          }}
          style={[styles.button, { borderColor: theme.border }]}
        >
          <Text style={[styles.label, { color: theme["muted-foreground"] }]}>
            {cancelLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  confirming: {
    gap: spacing.sm,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  button: {
    alignSelf: "flex-start",
    borderRadius: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
  question: {
    fontSize: 14,
  },
});
