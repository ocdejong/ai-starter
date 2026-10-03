import { createDatabaseClient, type Database } from "@ai-starter/db";
import { inject } from "vitest";

import {
  initAuth,
  type Auth,
  type AuthEmailDispatchers,
} from "../src/init-auth";

/** One captured dispatch, so a test can assert the flow, recipient and link. */
type CapturedEmail = {
  readonly flow: "verify" | "reset" | "change" | "delete";
  readonly to: string;
  readonly url: string;
};

/**
 * A captured group invitation. Better Auth does not build the accept URL — the
 * composition root does, from the app's own routing — so the factory hands over
 * the invitation id and this records exactly that.
 */
type CapturedInvitation = {
  readonly to: string;
  readonly invitationId: string;
};

/** A fake `EmailSender`-side dispatch record: the flows never send real mail. */
export type EmailInbox = {
  readonly messages: CapturedEmail[];
  readonly invitations: CapturedInvitation[];
  readonly dispatchers: AuthEmailDispatchers;
  latest: (flow: CapturedEmail["flow"]) => CapturedEmail | undefined;
  latestInvitation: () => CapturedInvitation | undefined;
  clear: () => void;
};

export function createEmailInbox(): EmailInbox {
  const messages: CapturedEmail[] = [];
  const invitations: CapturedInvitation[] = [];
  const record =
    (flow: CapturedEmail["flow"]) => (message: { to: string; url: string }) => {
      messages.push({ flow, to: message.to, url: message.url });
    };

  return {
    clear: () => {
      messages.length = 0;
      invitations.length = 0;
    },
    dispatchers: {
      sendChangeEmailVerification: record("change"),
      sendDeleteAccountVerification: record("delete"),
      sendGroupInvitation: ({ invitationId, to }) => {
        invitations.push({ invitationId, to });
      },
      sendPasswordReset: record("reset"),
      sendVerification: record("verify"),
    },
    invitations,
    latest: (flow) =>
      messages.filter((message) => message.flow === flow).at(-1),
    latestInvitation: () => invitations.at(-1),
    messages,
  };
}

/**
 * Binds a client and an auth instance to the package's one PostgreSQL, which
 * the integration global setup starts and migrates exactly as production would.
 * Real database, real migrations — the flows are exercised end to end, never
 * against a mock.
 */
export async function startAuthHarness(inbox: EmailInbox): Promise<{
  client: Database;
  auth: Auth;
}> {
  const client = createDatabaseClient(inject("databaseUrl"));
  const auth = initAuth({
    baseURL: "http://localhost:3000",
    database: client,
    email: inbox.dispatchers,
    secret: "integration-secret-integration-secret",
    trustedOrigins: ["ai-starter://"],
  });

  return { auth, client };
}

/** The session cookie Better Auth set, folded into a single `Cookie` header. */
export function sessionCookie(response: Response): string {
  const setCookie = response.headers.get("set-cookie") ?? "";
  return setCookie
    .split(/,(?=[^;]+?=)/)
    .map((entry) => entry.split(";")[0]?.trim() ?? "")
    .filter(Boolean)
    .join("; ");
}

/** Better Auth puts the reset token in the path; verification tokens in a query. */
export function tokenFromUrl(url: string): string {
  const parsed = new URL(url);
  return (
    parsed.searchParams.get("token") ??
    parsed.pathname.split("/").filter(Boolean).at(-1) ??
    ""
  );
}
