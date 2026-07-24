import { spacing } from "@ai-starter/tokens";
import { Pressable, StyleSheet, Text } from "react-native";

import { useTheme } from "../../theme/theme-provider";

/**
 * The one primary action on an account screen. While the request is in flight it
 * is disabled and says so, because a second tap would start a second request.
 */
export function SubmitButton({
  label,
  onPress,
  pending,
  pendingLabel,
}: {
  label: string;
  onPress: () => void;
  pending: boolean;
  pendingLabel?: string | undefined;
}) {
  const { theme } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: pending, disabled: pending }}
      disabled={pending}
      onPress={onPress}
      style={[
        styles.button,
        { backgroundColor: theme.primary, opacity: pending ? 0.6 : 1 },
      ]}
    >
      <Text style={[styles.label, { color: theme["primary-foreground"] }]}>
        {pending ? (pendingLabel ?? label) : label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
});
