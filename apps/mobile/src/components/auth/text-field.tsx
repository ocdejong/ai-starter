import { spacing } from "@ai-starter/tokens";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { useTheme } from "../../theme/theme-provider";

/**
 * A labelled input that shows its own validation message.
 *
 * The label doubles as the input's accessibility label, so assistive technology
 * and the component tests address the field the same way a reader sees it. An
 * invalid field is marked by color *and* by the message below it, never by color
 * alone.
 */
export function TextField({
  autoComplete,
  error,
  keyboardType,
  label,
  onChangeText,
  secureTextEntry = false,
  value,
}: {
  autoComplete?: "email" | "name" | "new-password" | "current-password";
  error?: string | undefined;
  keyboardType?: "email-address";
  label: string;
  onChangeText: (next: string) => void;
  secureTextEntry?: boolean;
  value: string;
}) {
  const { theme } = useTheme();

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.foreground }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        {...(autoComplete === undefined ? {} : { autoComplete })}
        {...(keyboardType === undefined ? {} : { keyboardType })}
        onChangeText={onChangeText}
        placeholderTextColor={theme["muted-foreground"]}
        secureTextEntry={secureTextEntry}
        style={[
          styles.input,
          {
            backgroundColor: theme.card,
            borderColor: error === undefined ? theme.input : theme.destructive,
            color: theme.foreground,
          },
        ]}
        value={value}
      />
      {error === undefined ? null : (
        <Text style={[styles.error, { color: theme.destructive }]}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
  input: {
    borderRadius: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  error: {
    fontSize: 14,
  },
});
