"use client";

import { type GroupRole } from "@ai-starter/domain";
import { useTranslations } from "next-intl";

import { GroupError } from "~/components/groups/group-error";
import { useGroupAction } from "~/components/groups/use-group-action";
import { useRoleLabel } from "~/components/groups/use-role-label";
import { Button } from "~/components/ui/button";
import { authClient } from "~/server/better-auth/client";

/** One invitation of the active group, as the group endpoint serves it. */
export type GroupInvitationView = {
  readonly email: string;
  readonly expiresAt: Date;
  readonly id: string;
  readonly role: GroupRole | null;
};

/**
 * The invitations still waiting for an answer.
 *
 * Only pending, unexpired ones are listed: an expired invitation is refused as a
 * missing one, so showing it would promise a link that no longer works. Sending
 * again issues a fresh invitation and — because the auth factory sets
 * `cancelPendingInvitationsOnReInvite` — withdraws the previous one, which is
 * why the list does not grow an entry per attempt.
 */
export function PendingInvitations({
  invitations,
  onChanged,
}: {
  readonly invitations: readonly GroupInvitationView[];
  readonly onChanged: () => void;
}) {
  const t = useTranslations("app.settings.groups.invitations");
  const roleLabel = useRoleLabel();
  const { error, pendingId, run } = useGroupAction(onChanged);

  return (
    <section aria-labelledby="group-invitations" className="space-y-3">
      <h3 className="text-lg font-medium" id="group-invitations">
        {t("title")}
      </h3>
      {invitations.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("none")}</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {invitations.map((invitation) => {
            const busy = pendingId === invitation.id;
            // A local const keeps the narrowing inside the callback below, which
            // a property access would lose.
            const resendRole = invitation.role;

            return (
              <li
                className="border-border flex flex-wrap items-center gap-3 border-t pt-2"
                key={invitation.id}
              >
                <span>{invitation.email}</span>
                <span className="text-muted-foreground">
                  {roleLabel(invitation.role)}
                </span>
                <span className="text-muted-foreground">
                  {t("expires", { expires: invitation.expiresAt })}
                </span>
                <span className="ml-auto flex gap-2">
                  {resendRole === null ? null : (
                    <Button
                      disabled={busy}
                      onClick={() => {
                        run(invitation.id, () =>
                          authClient.organization.inviteMember({
                            email: invitation.email,
                            resend: true,
                            role: resendRole,
                          }),
                        );
                      }}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {busy ? t("resending") : t("resend")}
                    </Button>
                  )}
                  <Button
                    disabled={busy}
                    onClick={() => {
                      run(invitation.id, () =>
                        authClient.organization.cancelInvitation({
                          invitationId: invitation.id,
                        }),
                      );
                    }}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    {busy ? t("cancelling") : t("cancel")}
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <GroupError code={error} />
    </section>
  );
}
