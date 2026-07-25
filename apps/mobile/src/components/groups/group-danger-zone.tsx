import { spacing } from "@ai-starter/tokens";
import { StyleSheet, Text, View } from "react-native";
import { useTranslations } from "use-intl";

import { ConfirmAction } from "./confirm-action";
import { useGroupAction } from "./use-group-action";
import { useGroupErrorMessage } from "./use-group-labels";
import { authClient } from "../../auth/client";
import { Notice } from "../auth/notice";
import { useTheme } from "../../theme/theme-provider";

/**
 * Leaving a group, and deleting one.
 *
 * A group always has an owner: the auth server refuses to let its only owner
 * leave, be removed or be demoted, so an ownerless group cannot come about. That
 * leaves the last owner two honest exits, and this says which — hand ownership
 * over, or delete the group — rather than offering a button that is refused.
 */
export function GroupDangerZone({
  canDelete,
  groupId,
  isOnlyOwner,
  name,
  onLeft,
}: {
  canDelete: boolean;
  groupId: string;
  isOnlyOwner: boolean;
  name: string;
  onLeft: () => void;
}) {
  const t = useTranslations("app.settings.groups.danger");
  const { theme } = useTheme();
  const { error, pendingId, run } = useGroupAction(onLeft);
  const errorMessage = useGroupErrorMessage()(error);

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: theme.foreground }]}>
        {t("title")}
      </Text>
      {isOnlyOwner ? (
        <Text style={[styles.body, { color: theme["muted-foreground"] }]}>
          {t("lastOwner", { name })}
        </Text>
      ) : (
        <ConfirmAction
          busy={pendingId === "leave"}
          busyLabel={t("leaving")}
          cancelLabel={t("cancel")}
          confirmLabel={t("confirm")}
          label={t("leave")}
          onConfirm={() => {
            run("leave", () =>
              authClient.organization.leave({ organizationId: groupId }),
            );
          }}
          question={t("confirmLeave", { name })}
        />
      )}
      {canDelete ? (
        <ConfirmAction
          busy={pendingId === "delete"}
          busyLabel={t("deleting")}
          cancelLabel={t("cancel")}
          confirmLabel={t("confirm")}
          label={t("delete")}
          onConfirm={() => {
            run("delete", () =>
              authClient.organization.delete({ organizationId: groupId }),
            );
          }}
          question={t("confirmDelete", { name })}
        />
      ) : null}
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
  body: {
    fontSize: 14,
  },
});
