"use client";

import { type GroupRole } from "@ai-starter/domain";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { InvitationPanel } from "~/components/groups/invitation-panel";
import { useRoleLabel } from "~/components/groups/use-role-label";
import { Button } from "~/components/ui/button";
import { dashboardPath } from "~/lib/routes";
import { authClient } from "~/server/better-auth/client";

/** Which invitation refusals mean the link itself is spent. */
const spentInvitationCodes = new Set([
  "INVITATION_NOT_FOUND",
  "YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION",
]);

/**
 * Answering an invitation.
 *
 * Accepting joins the group and switches the session to it, so the dashboard is
 * where it lands. A refusal is reported as a spent link rather than explained:
 * expired, withdrawn and already-accepted all answer the same way on purpose, so
 * a stale link can never confirm that a group — or an invitation — exists.
 */
export function InvitationActions({
  groupName,
  invitationId,
  inviterEmail,
  role,
}: {
  readonly groupName: string;
  readonly invitationId: string;
  readonly inviterEmail: string;
  readonly role: GroupRole | null;
}) {
  const t = useTranslations("app.invitation");
  const roleLabel = useRoleLabel();
  const router = useRouter();
  const [outcome, setOutcome] = useState<
    "declined" | "failed" | "spent" | null
  >(null);
  const [pending, setPending] = useState<"accept" | "decline" | null>(null);

  function answer(
    action: "accept" | "decline",
    call: () => Promise<{ error: { code?: string | undefined } | null }>,
    onAccepted: () => void,
  ): void {
    setPending(action);
    void (async () => {
      try {
        const { error } = await call();
        if (error !== null) {
          setOutcome(
            error.code !== undefined && spentInvitationCodes.has(error.code)
              ? "spent"
              : "failed",
          );
          return;
        }
        onAccepted();
      } catch {
        setOutcome("failed");
      } finally {
        setPending(null);
      }
    })();
  }

  if (outcome === "spent") {
    return (
      <InvitationPanel
        description={t("invalid.description")}
        title={t("invalid.title")}
      />
    );
  }
  if (outcome === "declined") {
    return (
      <InvitationPanel
        description={t("declined.description")}
        title={t("declined.title")}
      />
    );
  }

  return (
    <InvitationPanel
      description={t("pending.description", {
        group: groupName,
        inviter: inviterEmail,
        role: roleLabel(role),
      })}
      title={t("pending.title", { group: groupName })}
    >
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pending !== null}
          onClick={() => {
            answer(
              "accept",
              () => authClient.organization.acceptInvitation({ invitationId }),
              () => {
                router.push(dashboardPath);
                router.refresh();
              },
            );
          }}
          type="button"
        >
          {pending === "accept" ? t("pending.accepting") : t("pending.accept")}
        </Button>
        <Button
          disabled={pending !== null}
          onClick={() => {
            answer(
              "decline",
              () => authClient.organization.rejectInvitation({ invitationId }),
              () => {
                setOutcome("declined");
              },
            );
          }}
          type="button"
          variant="ghost"
        >
          {pending === "decline"
            ? t("pending.declining")
            : t("pending.decline")}
        </Button>
      </div>
      {outcome === "failed" ? (
        <p className="text-destructive text-sm" role="alert">
          {t("failed")}
        </p>
      ) : null}
    </InvitationPanel>
  );
}
