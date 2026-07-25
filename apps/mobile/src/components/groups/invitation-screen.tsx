import { parseGroupRole, type GroupRole } from "@ai-starter/domain";
import { spacing } from "@ai-starter/tokens";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslations } from "use-intl";

import { useRoleLabel } from "./use-group-labels";
import { authClient } from "../../auth/client";
import { Notice } from "../auth/notice";
import { SubmitButton } from "../auth/submit-button";
import { TextLink } from "../auth/text-link";
import { useTheme } from "../../theme/theme-provider";

type Invitation = {
  readonly groupName: string;
  readonly inviterEmail: string;
  readonly role: GroupRole | null;
};

type State =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly invitation: Invitation }
  | { readonly kind: "declined" }
  | { readonly kind: "spent" };

/** Which refusals mean the link itself is spent rather than the request. */
const spentInvitationCodes = new Set([
  "INVITATION_NOT_FOUND",
  "YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION",
]);

/**
 * Where a deep-linked group invitation lands.
 *
 * The session gate has already sent a signed-out visitor to sign in, so this
 * screen always runs for someone the server can identify — which is what the
 * invitation is checked against. Expired, withdrawn, already answered and
 * addressed-to-someone-else all end in one state on purpose: a stale link must
 * never confirm that a group exists.
 */
export function InvitationScreen({
  invitationId,
  onDone,
}: {
  invitationId: string;
  onDone: () => void;
}) {
  const t = useTranslations("app.invitation");
  const { theme } = useTheme();
  const roleLabel = useRoleLabel();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState<"accept" | "decline" | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { data, error } = await authClient.organization.getInvitation({
        query: { id: invitationId },
      });
      if (cancelled) {
        return;
      }
      setState(
        error !== null || data === null
          ? { kind: "spent" }
          : {
              invitation: {
                groupName: data.organizationName,
                inviterEmail: data.inviterEmail,
                role: parseGroupRole(data.role),
              },
              kind: "ready",
            },
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [invitationId]);

  function answer(
    action: "accept" | "decline",
    call: () => Promise<{ error: { code?: string | undefined } | null }>,
    onAccepted: () => void,
  ): void {
    setFailed(false);
    setPending(action);
    void (async () => {
      try {
        const { error } = await call();
        if (error !== null) {
          if (
            error.code !== undefined &&
            spentInvitationCodes.has(error.code)
          ) {
            setState({ kind: "spent" });
          } else {
            setFailed(true);
          }
          return;
        }
        onAccepted();
      } catch {
        setFailed(true);
      } finally {
        setPending(null);
      }
    })();
  }

  if (state.kind === "loading") {
    return null;
  }

  if (state.kind !== "ready") {
    return (
      <View style={styles.screen}>
        <Text style={[styles.title, { color: theme.foreground }]}>
          {state.kind === "spent" ? t("invalid.title") : t("declined.title")}
        </Text>
        <Text style={[styles.body, { color: theme["muted-foreground"] }]}>
          {state.kind === "spent"
            ? t("invalid.description")
            : t("declined.description")}
        </Text>
        <TextLink label={t("dashboard")} onPress={onDone} />
      </View>
    );
  }

  const { invitation } = state;

  return (
    <View style={styles.screen}>
      <Text style={[styles.title, { color: theme.foreground }]}>
        {t("pending.title", { group: invitation.groupName })}
      </Text>
      <Text style={[styles.body, { color: theme["muted-foreground"] }]}>
        {t("pending.description", {
          group: invitation.groupName,
          inviter: invitation.inviterEmail,
          role: roleLabel(invitation.role),
        })}
      </Text>
      <SubmitButton
        label={t("pending.accept")}
        onPress={() => {
          answer(
            "accept",
            () => authClient.organization.acceptInvitation({ invitationId }),
            onDone,
          );
        }}
        pending={pending === "accept"}
        pendingLabel={t("pending.accepting")}
      />
      <TextLink
        label={
          pending === "decline" ? t("pending.declining") : t("pending.decline")
        }
        onPress={() => {
          answer(
            "decline",
            () => authClient.organization.rejectInvitation({ invitationId }),
            () => {
              setState({ kind: "declined" });
            },
          );
        }}
      />
      {failed ? <Notice message={t("failed")} tone="error" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
});
