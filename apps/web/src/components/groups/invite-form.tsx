"use client";

import {
  assignableGroupRoles,
  groupErrorFor,
  inviteMemberInputSchema,
  type GroupErrorCode,
  type GroupRole,
  type InviteMemberInput,
} from "@ai-starter/domain";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { GroupError } from "~/components/groups/group-error";
import { GroupFieldError } from "~/components/groups/group-field-error";
import { useRoleLabel } from "~/components/groups/use-role-label";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select } from "~/components/ui/select";
import { authClient } from "~/server/better-auth/client";

/**
 * Invites an address into the active group.
 *
 * The roles on offer come from `assignableGroupRoles`, so an admin is never
 * shown the owner role the server would refuse them. No group id is sent: the
 * invitation is created in whichever group the session names, which is the same
 * group the members list above it is showing.
 */
export function InviteForm({
  onChanged,
  viewerRole,
}: {
  readonly onChanged: () => void;
  readonly viewerRole: GroupRole;
}) {
  const t = useTranslations("app.settings.groups.invite");
  const roleLabel = useRoleLabel();
  const roles = assignableGroupRoles(viewerRole);
  const [error, setError] = useState<GroupErrorCode | null>(null);
  const [invited, setInvited] = useState<string | null>(null);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<InviteMemberInput>({
    defaultValues: { email: "", role: "member" },
    resolver: zodResolver(inviteMemberInputSchema),
  });

  return (
    <section aria-labelledby="group-invite" className="space-y-3">
      <h3 className="text-lg font-medium" id="group-invite">
        {t("title")}
      </h3>
      <form
        className="space-y-3"
        noValidate
        onSubmit={handleSubmit(async ({ email, role }) => {
          setError(null);
          setInvited(null);
          const { error: failure } = await authClient.organization.inviteMember(
            {
              email,
              role,
            },
          );

          if (failure) {
            setError(groupErrorFor(failure.code));
            return;
          }
          setInvited(email);
          reset();
          onChanged();
        })}
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1 space-y-1.5">
            <Label htmlFor="invite-email">{t("emailLabel")}</Label>
            <Input
              {...register("email")}
              aria-describedby={
                errors.email === undefined ? undefined : "invite-email-error"
              }
              aria-invalid={errors.email !== undefined}
              autoComplete="email"
              id="invite-email"
              type="email"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">{t("roleLabel")}</Label>
            <Select {...register("role")} className="w-auto" id="invite-role">
              {roles.map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role)}
                </option>
              ))}
            </Select>
          </div>
          <Button disabled={isSubmitting} type="submit">
            {isSubmitting ? t("submitting") : t("submit")}
          </Button>
        </div>
        <GroupFieldError
          id="invite-email-error"
          message={errors.email?.message}
        />
        <GroupError code={error} />
        {invited === null ? null : (
          <p className="text-muted-foreground text-sm" role="status">
            {t("sent", { email: invited })}
          </p>
        )}
      </form>
    </section>
  );
}
