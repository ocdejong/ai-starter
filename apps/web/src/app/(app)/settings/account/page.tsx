import { describeDevice } from "@ai-starter/domain";
import { getFormatter, getTranslations } from "next-intl/server";
import { headers } from "next/headers";

import { ChangeEmailForm } from "~/components/settings/change-email-form";
import { ChangePasswordForm } from "~/components/settings/change-password-form";
import { DeleteAccountSection } from "~/components/settings/delete-account-section";
import { ProfileForm } from "~/components/settings/profile-form";
import {
  SessionsList,
  type SessionView,
} from "~/components/settings/sessions-list";
import { SettingsNotice } from "~/components/settings/settings-error";
import { emailChangeConfirmed, emailChangeParam } from "~/lib/routes";
import { parseQueryValue } from "~/lib/search-params";
import { auth } from "~/server/better-auth";
import { requireSession } from "~/server/better-auth/server";
import { revokeOtherSessionsAction, revokeSessionAction } from "./actions";

/**
 * Everything a person can do to their own account.
 *
 * The session list is read here rather than in the browser so that no session
 * token has to leave the server: the page projects each row down to what is safe
 * to render, and rows are revoked by id through a server action.
 *
 * Both halves of an email change redirect back to this page, so it also answers
 * for the link the reader has just opened. It cannot tell the two halves apart —
 * Better Auth carries one `callbackURL` through both — so it says only that the
 * link was accepted, and lets the address it displays be the real answer.
 */
export default async function AccountSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [t, format, session, query, requestHeaders] = await Promise.all([
    getTranslations("app.settings"),
    getFormatter(),
    requireSession(),
    searchParams,
    headers(),
  ]);
  const sessions = await auth.api.listSessions({ headers: requestHeaders });
  const emailChange = parseQueryValue(query[emailChangeParam]);
  const linkError = parseQueryValue(query.error);

  const views: SessionView[] = sessions
    .map((row) => ({
      ...describeDevice(row.userAgent ?? null),
      id: row.id,
      isCurrent: row.token === session.session.token,
      // Formatted here, not in the browser: the same string has to come out of
      // the server render and the hydration that follows it.
      lastActive: format.dateTime(new Date(row.updatedAt), {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    }))
    // The device being used comes first; the rest are what there is to review.
    .sort(
      (first, second) => Number(second.isCurrent) - Number(first.isCurrent),
    );

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold" id="account-settings">
        {t("account")}
      </h2>
      {linkError === undefined ? null : (
        <p
          className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm"
          role="alert"
        >
          {t("email.linkRejected")}
        </p>
      )}
      {emailChange === emailChangeConfirmed && linkError === undefined ? (
        <SettingsNotice>{t("email.linkAccepted")}</SettingsNotice>
      ) : null}
      <ProfileForm name={session.user.name} />
      <ChangeEmailForm email={session.user.email} />
      <ChangePasswordForm />
      <SessionsList
        revokeOtherSessions={revokeOtherSessionsAction}
        revokeSession={revokeSessionAction}
        sessions={views}
      />
      <DeleteAccountSection email={session.user.email} />
    </div>
  );
}
