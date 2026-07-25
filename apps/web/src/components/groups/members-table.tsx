"use client";

import {
  assignableGroupRoles,
  parseGroupRole,
  type GroupRole,
} from "@ai-starter/domain";
import { useTranslations } from "next-intl";

import { ConfirmButton } from "~/components/groups/confirm-button";
import { GroupError } from "~/components/groups/group-error";
import { useGroupAction } from "~/components/groups/use-group-action";
import { useRoleLabel } from "~/components/groups/use-role-label";
import { Select } from "~/components/ui/select";
import { authClient } from "~/server/better-auth/client";

/** One row of the members list, as the group endpoint serves it. */
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
 * Which affordances render is decided by `assignableGroupRoles`, which mirrors
 * the auth server's rule that only an owner may act on an owner or hand out the
 * owner role. Withholding a control is a courtesy, not a boundary: the same
 * refusals are enforced on every request, and `group-flows.integration.test.ts`
 * proves a plain member is refused each of these actions even when the request
 * is made without going through this table.
 */
export function MembersTable({
  members,
  onChanged,
  viewerRole,
  viewerUserId,
}: {
  readonly members: readonly GroupMemberView[];
  readonly onChanged: () => void;
  readonly viewerRole: GroupRole;
  readonly viewerUserId: string;
}) {
  const t = useTranslations("app.settings.groups.members");
  const roleLabel = useRoleLabel();
  const assignable = assignableGroupRoles(viewerRole);
  const { error, pendingId, run } = useGroupAction(onChanged);

  return (
    <section aria-labelledby="group-members" className="space-y-3">
      <h3 className="text-lg font-medium" id="group-members">
        {t("title")}
      </h3>
      <table className="w-full text-left text-sm">
        <thead className="text-muted-foreground">
          <tr>
            <th className="py-1 font-medium" scope="col">
              {t("name")}
            </th>
            <th className="py-1 font-medium" scope="col">
              {t("email")}
            </th>
            <th className="py-1 font-medium" scope="col">
              {t("role")}
            </th>
            <th className="py-1 font-medium" scope="col">
              {t("actions")}
            </th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => {
            const role = parseGroupRole(member.role);
            const isViewer = member.user.id === viewerUserId;
            // A role this application does not assign is left alone rather than
            // offered as something it is not, and nobody manages their own row —
            // leaving a group has its own control, with its own consequences.
            const manageableRole =
              !isViewer && role !== null && assignable.includes(role)
                ? role
                : null;
            const busy = pendingId === member.id;

            return (
              <tr className="border-border border-t align-top" key={member.id}>
                <th className="py-2 font-normal" scope="row">
                  {member.user.name}
                  {isViewer ? (
                    <span className="text-muted-foreground"> ({t("you")})</span>
                  ) : null}
                </th>
                <td className="text-muted-foreground py-2">
                  {member.user.email}
                </td>
                <td className="py-2">
                  {manageableRole === null ? (
                    roleLabel(role)
                  ) : (
                    <>
                      <label
                        className="sr-only"
                        htmlFor={`member-role-${member.id}`}
                      >
                        {t("roleLabel", { name: member.user.name })}
                      </label>
                      <Select
                        className="w-auto"
                        disabled={busy}
                        id={`member-role-${member.id}`}
                        onChange={(event) => {
                          const nextRole = event.target.value;
                          run(member.id, () =>
                            authClient.organization.updateMemberRole({
                              memberId: member.id,
                              role: nextRole,
                            }),
                          );
                        }}
                        value={manageableRole}
                      >
                        {assignable.map((option) => (
                          <option key={option} value={option}>
                            {roleLabel(option)}
                          </option>
                        ))}
                      </Select>
                    </>
                  )}
                </td>
                <td className="py-2">
                  {manageableRole === null ? null : (
                    <ConfirmButton
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
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <GroupError code={error} />
    </section>
  );
}
