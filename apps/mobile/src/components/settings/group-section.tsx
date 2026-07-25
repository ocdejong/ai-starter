import { parseGroupRole, type GroupRole } from "@ai-starter/domain";
import { spacing } from "@ai-starter/tokens";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslations } from "use-intl";

import { authClient } from "../../auth/client";
import { useTheme } from "../../theme/theme-provider";
import { GroupDangerZone } from "../groups/group-danger-zone";
import { CreateGroupForm, GroupNameForm } from "../groups/group-forms";
import { GroupSwitcher } from "../groups/group-switcher";
import { InviteForm } from "../groups/invite-form";
import { MembersList, type GroupMemberView } from "../groups/members-list";
import {
  PendingInvitations,
  type GroupInvitationView,
} from "../groups/pending-invitations";

/**
 * The group section of the settings tab: switching, members, roles, invitations,
 * leaving and deleting.
 *
 * Everything it shows is about the group the session names — no group id is sent
 * from here — and everything it offers is decided by the caller's role in that
 * group, read through `checkRolePermission`, which answers from the same access
 * control the server enforces with.
 */
export function GroupSection() {
  const t = useTranslations("app.settings.groups");
  const tSection = useTranslations("app.settings");
  const { theme } = useTheme();
  const groups = authClient.useListOrganizations();
  const activeGroup = authClient.useActiveOrganization();
  const activeMember = authClient.useActiveMember();
  // When this screen was opened, which is what decides whether an invitation is
  // still worth showing; reading a clock during render would make the component
  // impure.
  const [openedAt] = useState(() => Date.now());

  function reload(): void {
    void Promise.all([
      groups.refetch(),
      activeGroup.refetch(),
      activeMember.refetch(),
    ]);
  }

  if (activeGroup.isPending || groups.isPending) {
    return (
      <View style={styles.section}>
        <Text style={[styles.heading, { color: theme.foreground }]}>
          {tSection("group")}
        </Text>
        <Text style={[styles.body, { color: theme["muted-foreground"] }]}>
          {t("loading")}
        </Text>
      </View>
    );
  }

  const group = activeGroup.data;
  const groupList = groups.data ?? [];

  if (group === null || group === undefined) {
    // Leaving or deleting the last group leaves the session without an active
    // one; a first group is the only thing worth offering then.
    return (
      <View style={styles.section}>
        <Text style={[styles.heading, { color: theme.foreground }]}>
          {t("empty.title")}
        </Text>
        <Text style={[styles.body, { color: theme["muted-foreground"] }]}>
          {t("empty.description")}
        </Text>
        <CreateGroupForm onCreated={reload} />
      </View>
    );
  }

  // An unreadable role is treated as the least privileged one, so the interface
  // offers nothing the server would refuse.
  const viewerRole: GroupRole =
    parseGroupRole(activeMember.data?.role) ?? "member";
  const members: readonly GroupMemberView[] = group.members;
  const ownerCount = members.filter(
    (member) => parseGroupRole(member.role) === "owner",
  ).length;
  const invitations: readonly GroupInvitationView[] = group.invitations
    .filter(
      (invitation) =>
        invitation.status === "pending" &&
        new Date(invitation.expiresAt).getTime() > openedAt,
    )
    .map((invitation) => ({
      email: invitation.email,
      expiresAt: new Date(invitation.expiresAt),
      id: invitation.id,
      role: parseGroupRole(invitation.role),
    }));
  const may = (
    permissions: Parameters<
      typeof authClient.organization.checkRolePermission
    >[0]["permissions"],
  ): boolean =>
    authClient.organization.checkRolePermission({
      permissions,
      role: viewerRole,
    });

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: theme.foreground }]}>
        {tSection("group")}
      </Text>
      <GroupSwitcher
        activeGroupId={group.id}
        groups={groupList}
        onSwitched={reload}
      />
      <GroupNameForm
        canRename={may({ organization: ["update"] })}
        name={group.name}
        onRenamed={reload}
      />
      <MembersList
        members={members}
        onChanged={reload}
        viewerRole={viewerRole}
        viewerUserId={activeMember.data?.userId ?? ""}
      />
      {may({ invitation: ["create"] }) ? (
        <>
          <InviteForm onInvited={reload} viewerRole={viewerRole} />
          <PendingInvitations invitations={invitations} onChanged={reload} />
        </>
      ) : null}
      <GroupDangerZone
        canDelete={may({ organization: ["delete"] })}
        groupId={group.id}
        isOnlyOwner={viewerRole === "owner" && ownerCount === 1}
        name={group.name}
        onLeft={() => {
          void (async () => {
            const next = groupList.find(
              (candidate) => candidate.id !== group.id,
            );
            if (next !== undefined) {
              await authClient.organization.setActive({
                organizationId: next.id,
              });
            }
            reload();
          })();
        }}
      />
      <CreateGroupForm onCreated={reload} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.lg,
  },
  heading: {
    fontSize: 20,
    fontWeight: "700",
  },
  body: {
    fontSize: 14,
  },
});
