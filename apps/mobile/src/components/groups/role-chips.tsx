import { spacing } from "@ai-starter/tokens";
import { type GroupRole } from "@ai-starter/domain";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useRoleLabel } from "./use-group-labels";
import { useTheme } from "../../theme/theme-provider";

/**
 * Picks one role out of the few on offer.
 *
 * Native has no select worth using here, and the list is three items at most, so
 * the options are simply visible. The group carries the accessible label — "Role
 * of Alan Turing" — so a reader hears whose role they are changing, and each
 * option reports whether it is the current one.
 */
export function RoleChips({
  disabled = false,
  label,
  onChange,
  options,
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (role: GroupRole) => void;
  options: readonly GroupRole[];
  value: GroupRole | null;
}) {
  const roleLabel = useRoleLabel();
  const { theme } = useTheme();

  return (
    <View accessibilityLabel={label} style={styles.row}>
      {options.map((option) => {
        const selected = option === value;

        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled, selected }}
            disabled={disabled}
            key={option}
            onPress={() => {
              onChange(option);
            }}
            style={[
              styles.chip,
              {
                backgroundColor: selected ? theme.primary : theme.card,
                borderColor: selected ? theme.primary : theme.border,
                opacity: disabled ? 0.6 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                {
                  color: selected
                    ? theme["primary-foreground"]
                    : theme.foreground,
                },
              ]}
            >
              {roleLabel(option)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    borderRadius: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
});
