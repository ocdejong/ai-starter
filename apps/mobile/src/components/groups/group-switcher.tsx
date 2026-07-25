import { spacing } from "@ai-starter/tokens";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslations } from "use-intl";

import { useGroupAction } from "./use-group-action";
import { useGroupErrorMessage } from "./use-group-labels";
import { authClient } from "../../auth/client";
import { Notice } from "../auth/notice";
import { useTheme } from "../../theme/theme-provider";

/** A group the account belongs to, as the group list serves it. */
export type GroupChoice = { readonly id: string; readonly name: string };

/**
 * Chooses which group the application is working in.
 *
 * The choice lives in the session rather than in this component: `setActive`
 * writes it server-side, and every group-scoped request re-derives the caller's
 * membership behind it. Switching is therefore never what decides what may be
 * seen — it only says which group is being asked about.
 */
export function GroupSwitcher({
  activeGroupId,
  groups,
  onSwitched,
}: {
  activeGroupId: string | null;
  groups: readonly GroupChoice[];
  onSwitched: () => void;
}) {
  const t = useTranslations("app.settings.groups");
  const { theme } = useTheme();
  const { error, pendingId, run } = useGroupAction(onSwitched);
  const errorMessage = useGroupErrorMessage()(error);

  if (groups.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.label, { color: theme["muted-foreground"] }]}>
        {t("switcherLabel")}
      </Text>
      <View accessibilityLabel={t("switcherLabel")} style={styles.row}>
        {groups.map((group) => {
          const selected = group.id === activeGroupId;

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{
                busy: pendingId === group.id,
                selected,
              }}
              disabled={pendingId !== null}
              key={group.id}
              onPress={() => {
                run(group.id, () =>
                  authClient.organization.setActive({
                    organizationId: group.id,
                  }),
                );
              }}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? theme.primary : theme.card,
                  borderColor: selected ? theme.primary : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipLabel,
                  {
                    color: selected
                      ? theme["primary-foreground"]
                      : theme.foreground,
                  },
                ]}
              >
                {group.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {errorMessage === null ? null : (
        <Notice message={errorMessage} tone="error" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
  chip: {
    borderRadius: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
});
