"use client";

import { parseGroupRole, type GroupRole } from "@ai-starter/domain";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CreateGroupForm } from "~/components/groups/create-group-form";
import { GroupDangerZone } from "~/components/groups/group-danger-zone";
import { GroupNameForm } from "~/components/groups/group-name-form";
import { InviteForm } from "~/components/groups/invite-form";
import {
  MembersTable,
  type GroupMemberView,
} from "~/components/groups/members-table";
import {
  PendingInvitations,
  type GroupInvitationView,
} from "~/components/groups/pending-invitations";
import { authClient } from "~/server/better-auth/client";

/**
 * The group section of the settings page.
 *
 * Everything it shows is about the group the session names — no group id is ever
 * sent from here — and everything it offers is decided by the caller's role in
 * that group, read through `checkRolePermission`, which answers from the same
 * access-control definition the server enforces with. The server refuses these
 * actions on its own; withholding the control only avoids offering what would be
 * refused.
 */
export function GroupSettings() {
  const t = useTranslations("app.settings.groups");
  const router = useRouter();
  const groups = authClient.useListOrganizations();
  const activeGroup = authClient.useActiveOrganization();
  const activeMember = authClient.useActiveMember();
  // When this screen was opened, which is what decides whether an invitation is
  // still worth showing. A clock read during render would make the component
  // impure; this reads it once, and a screen left open all day at worst keeps a
  // just-expired invitation on the list until the next navigation.
  const [openedAt] = useState(() => Date.now());

  async function refresh(): Promise<void> {
    await Promise.all([
      groups.refetch(),
      activeGroup.refetch(),
      activeMember.refetch(),
    ]);
    // Server components resolve their own group from the session, so they only
    // catch up when they are asked again.
    router.refresh();
  }

  function reload(): void {
    void refresh();
  }

  if (activeGroup.isPending || groups.isPending) {
    return <p className="text-muted-foreground text-sm">{t("loading")}</p>;
  }

  const group = activeGroup.data;
  if (group === null || group === undefined) {
    // Leaving or deleting the last group leaves the session without an active
    // one; a first group is the only thing worth offering here.
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">{t("empty.title")}</h2>
          <p className="text-muted-foreground text-sm">
            {t("empty.description")}
          </p>
        </div>
        <CreateGroupForm onCreated={reload} />
      </div>
    );
  }

  // An unreadable role is treated as the least privileged one: the interface
  // then offers nothing, and the server is asked nothing it would refuse.
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
    <div className="space-y-8">
      <GroupNameForm
        canRename={may({ organization: ["update"] })}
        name={group.name}
        onChanged={reload}
      />
      <MembersTable
        members={members}
        onChanged={reload}
        viewerRole={viewerRole}
        viewerUserId={activeMember.data?.userId ?? ""}
      />
      {may({ invitation: ["create"] }) ? (
        <>
          <InviteForm onChanged={reload} viewerRole={viewerRole} />
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
            const remaining = (groups.data ?? []).filter(
              (candidate) => candidate.id !== group.id,
            );
            const next = remaining[0];
            if (next !== undefined) {
              await authClient.organization.setActive({
                organizationId: next.id,
              });
            }
            await refresh();
          })();
        }}
      />
      <CreateGroupForm onCreated={reload} />
    </div>
  );
}
