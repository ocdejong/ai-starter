import {
  assignableGroupRoles,
  parseGroupRole,
  type GroupRole,
} from "@ai-starter/domain";
import { spacing } from "@ai-starter/tokens";
import { StyleSheet, Text, View } from "react-native";
import { useTranslations } from "use-intl";

import { ConfirmAction } from "./confirm-action";
import { RoleChips } from "./role-chips";
import { useGroupAction } from "./use-group-action";
import { useGroupErrorMessage, useRoleLabel } from "./use-group-labels";
import { authClient } from "../../auth/client";
import { Notice } from "../auth/notice";
import { useTheme } from "../../theme/theme-provider";

/** One member of the active group, as the group endpoint serves it. */
export type GroupMemberView = {
  readonly id: string;
  readonly role: string;
  readonly user: {
    readonly email: string;
    readonly id: string;
    readonly name: string;
  };
};

/**
 * Who is in this group, and — for whoever may — what to do about it.
 *
 * `assignableGroupRoles` decides which controls appear; it mirrors the auth
 * server's rule that only an owner may act on an owner or hand out the owner
 * role. Withholding a control is a courtesy rather than a boundary: the same
 * refusals are enforced on every request whether or not this list offered them.
 */
export function MembersList({
  members,
  onChanged,
  viewerRole,
  viewerUserId,
}: {
  members: readonly GroupMemberView[];
  onChanged: () => void;
  viewerRole: GroupRole;
  viewerUserId: string;
}) {
  const t = useTranslations("app.settings.groups.members");
  const { theme } = useTheme();
  const roleLabel = useRoleLabel();
  const assignable = assignableGroupRoles(viewerRole);
  const { error, pendingId, run } = useGroupAction(onChanged);
  const errorMessage = useGroupErrorMessage()(error);

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: theme.foreground }]}>
        {t("title")}
      </Text>
      {members.map((member) => {
        const role = parseGroupRole(member.role);
        const isViewer = member.user.id === viewerUserId;
        // Nobody manages their own row: leaving a group is its own control,
        // with its own consequences.
        const manageableRole =
          !isViewer && role !== null && assignable.includes(role) ? role : null;
        const busy = pendingId === member.id;

        return (
          <View
            key={member.id}
            style={[styles.member, { borderColor: theme.border }]}
          >
            <Text style={[styles.name, { color: theme.foreground }]}>
              {member.user.name}
              {isViewer ? ` ${t("viewerSuffix")}` : ""}
            </Text>
            <Text style={[styles.detail, { color: theme["muted-foreground"] }]}>
              {member.user.email}
            </Text>
            {manageableRole === null ? (
              <Text
                style={[styles.detail, { color: theme["muted-foreground"] }]}
              >
                {roleLabel(role)}
              </Text>
            ) : (
              <>
                <RoleChips
                  disabled={busy}
                  label={t("roleLabel", { name: member.user.name })}
                  onChange={(next) => {
                    run(member.id, () =>
                      authClient.organization.updateMemberRole({
                        memberId: member.id,
                        role: next,
                      }),
                    );
                  }}
                  options={assignable}
                  value={manageableRole}
                />
                <ConfirmAction
                  accessibilityLabel={t("removeLabel", {
                    name: member.user.name,
                  })}
                  busy={busy}
                  busyLabel={t("removing")}
                  cancelLabel={t("cancel")}
                  confirmLabel={t("confirm")}
                  label={t("remove")}
                  onConfirm={() => {
                    run(member.id, () =>
                      authClient.organization.removeMember({
                        memberIdOrEmail: member.id,
                      }),
                    );
                  }}
                  question={t("confirmRemove", { name: member.user.name })}
                />
              </>
            )}
          </View>
        );
      })}
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
  member: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
  },
  detail: {
    fontSize: 14,
  },
});
