import { parseGroupRole } from "@ai-starter/domain";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { headers } from "next/headers";

import { InvitationActions } from "~/components/groups/invitation-actions";
import { InvitationPanel } from "~/components/groups/invitation-panel";
import { LocaleSwitcher } from "~/components/locale-switcher";
import { ThemeToggle } from "~/components/theme-toggle";
import { signInPath } from "~/lib/routes";
import { auth } from "~/server/better-auth";
import { getSession } from "~/server/better-auth/server";

/** The invitation as this page needs it, or nothing it may show. */
async function readInvitation(invitationId: string) {
  try {
    return await auth.api.getInvitation({
      headers: await headers(),
      query: { id: invitationId },
    });
  } catch {
    // The auth server answers the same way for expired, withdrawn, already
    // answered and addressed-to-someone-else, and that is deliberate: a link
    // must not confirm that a group or an invitation exists to whoever holds it.
    return null;
  }
}

/**
 * Where an emailed invitation lands.
 *
 * It is neither an auth page nor an application page: a visitor arrives here
 * from their inbox, possibly signed in as the right person, possibly signed in
 * as someone else, possibly not signed in at all. So it sits outside both route
 * groups and says which of those it is rather than redirecting.
 */
export default async function InvitationPage({
  params,
}: {
  params: Promise<{ invitationId: string }>;
}) {
  const { invitationId } = await params;
  const t = await getTranslations("app.invitation");
  const session = await getSession();
  const invitation =
    session === null ? null : await readInvitation(invitationId);

  return (
    <main className="bg-background text-foreground relative flex min-h-screen flex-col items-center justify-center p-4">
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>
      <div className="bg-card text-card-foreground border-border w-full max-w-sm rounded-xl border p-6 shadow-sm">
        {session === null ? (
          <InvitationPanel
            description={t("signedOut.description")}
            title={t("signedOut.title")}
          >
            <div className="flex flex-wrap gap-4 text-sm">
              <Link
                className="text-primary underline-offset-4 hover:underline"
                href={signInPath}
              >
                {t("signedOut.signIn")}
              </Link>
              <Link
                className="text-primary underline-offset-4 hover:underline"
                href="/sign-up"
              >
                {t("signedOut.createAccount")}
              </Link>
            </div>
          </InvitationPanel>
        ) : invitation === null ? (
          <InvitationPanel
            description={t("invalid.description")}
            title={t("invalid.title")}
          />
        ) : (
          <InvitationActions
            groupName={invitation.organizationName}
            invitationId={invitation.id}
            inviterEmail={invitation.inviterEmail}
            role={parseGroupRole(invitation.role)}
          />
        )}
      </div>
    </main>
  );
}
