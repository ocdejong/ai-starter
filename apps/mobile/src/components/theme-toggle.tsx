import { spacing } from "@ai-starter/tokens";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme, type ThemePreference } from "../theme/theme-provider";

const options: readonly { label: string; value: ThemePreference }[] = [
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
  { label: "System", value: "system" },
];

export function ThemeToggle() {
  const { preference, setPreference, theme } = useTheme();

  return (
    <View
      style={[
        styles.group,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      {options.map(({ label, value }) => {
        const active = preference === value;

        return (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => {
              setPreference(value);
            }}
            style={[
              styles.option,
              active && { backgroundColor: theme.primary },
            ]}
          >
            <Text
              style={{
                color: active ? theme["primary-foreground"] : theme.foreground,
              }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    borderRadius: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.xs,
    padding: spacing.xs,
  },
  option: {
    borderRadius: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
