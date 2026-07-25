import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { createDatabaseClient, type Database } from "@ai-starter/db";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";

import {
  initAuth,
  type Auth,
  type AuthEmailDispatchers,
} from "../src/init-auth";

const execFileAsync = promisify(execFile);
const dbDirectory = fileURLToPath(new URL("../../db", import.meta.url));
const schemaPath = path.join(dbDirectory, "prisma/schema.prisma");

/** One captured dispatch, so a test can assert the flow, recipient and link. */
export type CapturedEmail = {
  readonly flow: "verify" | "reset" | "change" | "delete";
  readonly to: string;
  readonly url: string;
};

/**
 * A captured group invitation. Better Auth does not build the accept URL — the
 * composition root does, from the app's own routing — so the factory hands over
 * the invitation id and this records exactly that.
 */
export type CapturedInvitation = {
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
 * Spins up a throwaway PostgreSQL container, applies the committed migrations
 * exactly as production would, and returns a client plus a factory that builds
 * an auth instance bound to it. Real database, real migrations — the flows are
 * exercised end to end, never against a mock.
 */
export async function startAuthHarness(inbox: EmailInbox): Promise<{
  container: StartedPostgreSqlContainer;
  client: Database;
  auth: Auth;
}> {
  const container = await new PostgreSqlContainer("postgres:17-alpine").start();
  const databaseUrl = container.getConnectionUri();

  await execFileAsync(
    "pnpm",
    ["exec", "prisma", "migrate", "deploy", "--schema", schemaPath],
    { cwd: dbDirectory, env: { ...process.env, DATABASE_URL: databaseUrl } },
  );

  const client = createDatabaseClient(databaseUrl);
  const auth = initAuth({
    baseURL: "http://localhost:3000",
    database: client,
    email: inbox.dispatchers,
    secret: "integration-secret-integration-secret",
    trustedOrigins: ["ai-starter://"],
  });

  return { auth, client, container };
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
