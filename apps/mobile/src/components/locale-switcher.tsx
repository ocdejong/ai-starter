import { locales, type Locale } from "@ai-starter/i18n";
import { spacing } from "@ai-starter/tokens";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslations } from "use-intl";

import { useLocale } from "../i18n/locale-provider";
import { useTheme } from "../theme/theme-provider";

/** The locale label key that names each language in its own tongue. */
const labelKeys = { en: "english", nl: "dutch" } as const satisfies Record<
  Locale,
  "english" | "dutch"
>;

export function LocaleSwitcher() {
  const t = useTranslations("locale");
  const { locale, setLocale } = useLocale();
  const { theme } = useTheme();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t("label")}
      style={[
        styles.group,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      {locales.map((value) => {
        const active = locale === value;

        return (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => {
              setLocale(value);
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
              {t(labelKeys[value])}
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
