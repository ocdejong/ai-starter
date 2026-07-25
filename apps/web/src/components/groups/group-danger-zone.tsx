"use client";

import { useTranslations } from "next-intl";

import { ConfirmButton } from "~/components/groups/confirm-button";
import { GroupError } from "~/components/groups/group-error";
import { useGroupAction } from "~/components/groups/use-group-action";
import { authClient } from "~/server/better-auth/client";

/**
 * Leaving a group, and deleting one.
 *
 * A group always has an owner: the auth server refuses to let its only owner
 * leave, be removed or be demoted, so an ownerless group cannot come about and
 * nothing has to inherit one. That leaves the last owner two honest exits, and
 * this says which — hand ownership to someone else, or delete the group — rather
 * than offering a button that would be refused.
 *
 * Both actions clear the session's active group, so the caller re-points it at
 * whatever the account still belongs to; a request made in between would have no
 * group at all.
 */
export function GroupDangerZone({
  canDelete,
  groupId,
  isOnlyOwner,
  name,
  onLeft,
}: {
  readonly canDelete: boolean;
  readonly groupId: string;
  readonly isOnlyOwner: boolean;
  readonly name: string;
  readonly onLeft: () => void;
}) {
  const t = useTranslations("app.settings.groups.danger");
  const { error, pendingId, run } = useGroupAction(onLeft);

  return (
    <section aria-labelledby="group-danger" className="space-y-3">
      <h3 className="text-lg font-medium" id="group-danger">
        {t("title")}
      </h3>
      <div className="flex flex-wrap items-center gap-3">
        {isOnlyOwner ? (
          <p className="text-muted-foreground text-sm">
            {t("lastOwner", { name })}
          </p>
        ) : (
          <ConfirmButton
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
          <ConfirmButton
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
      </div>
      <GroupError code={error} />
    </section>
  );
}
