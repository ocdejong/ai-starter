import {
  assignableGroupRoles,
  groupErrorFor,
  inviteMemberInputSchema,
  parseGroupValidationCode,
  type GroupErrorCode,
  type GroupRole,
} from "@ai-starter/domain";
import { spacing } from "@ai-starter/tokens";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslations } from "use-intl";

import { RoleChips } from "./role-chips";
import { useGroupErrorMessage, useGroupFieldError } from "./use-group-labels";
import { authClient } from "../../auth/client";
import { Notice } from "../auth/notice";
import { SubmitButton } from "../auth/submit-button";
import { TextField } from "../auth/text-field";
import { useTheme } from "../../theme/theme-provider";

/**
 * Invites an address into the active group.
 *
 * The roles on offer come from `assignableGroupRoles`, so an admin is never
 * shown the owner role the server would refuse them, and no group id is sent —
 * the invitation is created in whichever group the session names.
 */
export function InviteForm({
  onInvited,
  viewerRole,
}: {
  onInvited: () => void;
  viewerRole: GroupRole;
}) {
  const t = useTranslations("app.settings.groups.invite");
  const { theme } = useTheme();
  const fieldError = useGroupFieldError();
  const errorMessage = useGroupErrorMessage();
  const roles = assignableGroupRoles(viewerRole);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<GroupRole>("member");
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<GroupErrorCode | null>(null);
  const [invited, setInvited] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function submit(): void {
    setError(null);
    setInvited(null);
    const parsed = inviteMemberInputSchema.safeParse({ email, role });
    if (!parsed.success) {
      setEmailError(
        fieldError(parseGroupValidationCode(parsed.error.issues[0]?.message)),
      );
      return;
    }

    setEmailError(undefined);
    setPending(true);
    void (async () => {
      try {
        const { error: failure } = await authClient.organization.inviteMember({
          email: parsed.data.email,
          role: parsed.data.role,
        });
        if (failure) {
          setError(groupErrorFor(failure.code));
          return;
        }
        setInvited(parsed.data.email);
        setEmail("");
        onInvited();
      } catch {
        setError("unexpected");
      } finally {
        setPending(false);
      }
    })();
  }

  const failure = errorMessage(error);

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: theme.foreground }]}>
        {t("title")}
      </Text>
      <TextField
        autoComplete="email"
        error={emailError}
        keyboardType="email-address"
        label={t("emailLabel")}
        onChangeText={setEmail}
        value={email}
      />
      <RoleChips
        label={t("roleLabel")}
        onChange={setRole}
        options={roles}
        value={role}
      />
      <SubmitButton
        label={t("submit")}
        onPress={submit}
        pending={pending}
        pendingLabel={t("submitting")}
      />
      {failure === null ? null : <Notice message={failure} tone="error" />}
      {invited === null ? null : (
        <Notice message={t("sent", { email: invited })} tone="info" />
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
});
