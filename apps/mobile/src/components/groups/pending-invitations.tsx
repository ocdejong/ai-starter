import { type GroupRole } from "@ai-starter/domain";
import { spacing } from "@ai-starter/tokens";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslations } from "use-intl";

import { useGroupAction } from "./use-group-action";
import { useGroupErrorMessage, useRoleLabel } from "./use-group-labels";
import { authClient } from "../../auth/client";
import { Notice } from "../auth/notice";
import { useTheme } from "../../theme/theme-provider";

/** One invitation of the active group, already narrowed for display. */
export type GroupInvitationView = {
  readonly email: string;
  readonly expiresAt: Date;
  readonly id: string;
  readonly role: GroupRole | null;
};

/**
 * The invitations still waiting for an answer.
 *
 * Sending again issues a fresh invitation and withdraws the previous one, so the
 * list does not grow an entry per attempt.
 */
export function PendingInvitations({
  invitations,
  onChanged,
}: {
  invitations: readonly GroupInvitationView[];
  onChanged: () => void;
}) {
  const t = useTranslations("app.settings.groups.invitations");
  const { theme } = useTheme();
  const roleLabel = useRoleLabel();
  const { error, pendingId, run } = useGroupAction(onChanged);
  const errorMessage = useGroupErrorMessage()(error);

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: theme.foreground }]}>
        {t("title")}
      </Text>
      {invitations.length === 0 ? (
        <Text style={[styles.detail, { color: theme["muted-foreground"] }]}>
          {t("none")}
        </Text>
      ) : (
        invitations.map((invitation) => {
          const busy = pendingId === invitation.id;
          // A local const keeps the narrowing inside the callbacks below.
          const resendRole = invitation.role;

          return (
            <View
              key={invitation.id}
              style={[styles.invitation, { borderColor: theme.border }]}
            >
              <Text style={[styles.name, { color: theme.foreground }]}>
                {invitation.email}
              </Text>
              <Text
                style={[styles.detail, { color: theme["muted-foreground"] }]}
              >
                {roleLabel(invitation.role)}
              </Text>
              <Text
                style={[styles.detail, { color: theme["muted-foreground"] }]}
              >
                {t("expires", { expires: invitation.expiresAt })}
              </Text>
              <View style={styles.actions}>
                {resendRole === null ? null : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ busy, disabled: busy }}
                    disabled={busy}
                    onPress={() => {
                      run(invitation.id, () =>
                        authClient.organization.inviteMember({
                          email: invitation.email,
                          resend: true,
                          role: resendRole,
                        }),
                      );
                    }}
                    style={[styles.button, { borderColor: theme.border }]}
                  >
                    <Text style={[styles.label, { color: theme.foreground }]}>
                      {busy ? t("resending") : t("resend")}
                    </Text>
                  </Pressable>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ busy, disabled: busy }}
                  disabled={busy}
                  onPress={() => {
                    run(invitation.id, () =>
                      authClient.organization.cancelInvitation({
                        invitationId: invitation.id,
                      }),
                    );
                  }}
                  style={[styles.button, { borderColor: theme.border }]}
                >
                  <Text
                    style={[styles.label, { color: theme["muted-foreground"] }]}
                  >
                    {busy ? t("cancelling") : t("cancel")}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })
      )}
      {errorMessage === null ? null : (
        <Notice message={errorMessage} tone="error" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  heading: {
    fontSize: 20,
    fontWeight: "700",
  },
  invitation: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
    paddingTop: spacing.md,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
  },
  detail: {
    fontSize: 14,
  },
  button: {
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
