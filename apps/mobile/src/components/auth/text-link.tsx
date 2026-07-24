import { spacing } from "@ai-starter/tokens";
import { Pressable, StyleSheet, Text } from "react-native";

import { useTheme } from "../../theme/theme-provider";

/** A secondary navigation action between account screens. */
export function TextLink({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();

  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={styles.link}>
      <Text style={[styles.label, { color: theme.foreground }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    paddingVertical: spacing.sm,
  },
  label: {
    fontSize: 15,
    textDecorationLine: "underline",
  },
});
