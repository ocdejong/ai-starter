import type { Database } from "@ai-starter/db";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  createEmailInbox,
  sessionCookie,
  startAuthHarness,
  tokenFromUrl,
  type EmailInbox,
} from "../test/harness";
import type { Auth } from "./init-auth";

const password = "password1234";
const newPassword = "password5678";

const inbox: EmailInbox = createEmailInbox();
let container: StartedPostgreSqlContainer;
let client: Database;
let auth: Auth;

beforeAll(async () => {
  ({ auth, client, container } = await startAuthHarness(inbox));
}, 120_000);

afterEach(async () => {
  inbox.clear();
  await client.invitation.deleteMany();
  await client.member.deleteMany();
  await client.organization.deleteMany();
  await client.post.deleteMany();
  await client.session.deleteMany();
  await client.account.deleteMany();
  await client.verification.deleteMany();
  await client.user.deleteMany();
});

afterAll(async () => {
  await client.$disconnect();
  await container.stop();
});

async function register(email: string): Promise<void> {
  await auth.api.signUpEmail({ body: { email, name: "Test", password } });
}

async function verifyLatest(flow: "verify" | "change"): Promise<void> {
  const message = inbox.latest(flow);
  if (message === undefined) {
    throw new Error(`no ${flow} email was captured`);
  }
  await auth.api.verifyEmail({ query: { token: tokenFromUrl(message.url) } });
}

async function registerAndVerify(email: string): Promise<void> {
  await register(email);
  await verifyLatest("verify");
}

async function signIn(
  email: string,
  secret: string = password,
): Promise<string> {
  const response = await auth.api.signInEmail({
    asResponse: true,
    body: { email, password: secret },
  });
  return sessionCookie(response);
}

describe("account flows", () => {
  it("registers, sends a verification email, verifies, and signs in", async () => {
    await register("new@example.com");

    const verification = inbox.latest("verify");
    expect(verification?.to).toBe("new@example.com");

    // Before verifying, the credentials must not grant a session.
    const beforeVerify = await auth.api.signInEmail({
      asResponse: true,
      body: { email: "new@example.com", password },
    });
    expect(beforeVerify.status).toBe(403);

    inbox.clear();
    await auth.api.verifyEmail({
      query: { token: tokenFromUrl(verification?.url ?? "") },
    });

    const cookie = await signIn("new@example.com");
    const session = await auth.api.getSession({
      headers: new Headers({ cookie }),
    });
    expect(session?.user.email).toBe("new@example.com");
    expect(session?.user.emailVerified).toBe(true);
  });

  it("refuses an unverified sign-in with 403 and resends verification", async () => {
    await register("unverified@example.com");
    expect(inbox.messages.filter((m) => m.flow === "verify")).toHaveLength(1);

    const response = await auth.api.signInEmail({
      asResponse: true,
      body: { email: "unverified@example.com", password },
    });

    expect(response.status).toBe(403);
    const verifications = inbox.messages.filter((m) => m.flow === "verify");
    expect(verifications).toHaveLength(2);
    expect(verifications.at(-1)?.to).toBe("unverified@example.com");
  });

  it("revokes existing sessions when the password is reset", async () => {
    await registerAndVerify("reset@example.com");
    const staleCookie = await signIn("reset@example.com");
    // Verification auto-signs the user in, so at least this and the fresh
    // sign-in exist to be revoked.
    expect(await client.session.count()).toBeGreaterThan(0);

    await auth.api.requestPasswordReset({
      body: { email: "reset@example.com", redirectTo: "/reset" },
    });
    await auth.api.resetPassword({
      body: {
        newPassword,
        token: tokenFromUrl(inbox.latest("reset")?.url ?? ""),
      },
    });

    // Every session minted before the reset is gone...
    expect(await client.session.count()).toBe(0);
    const staleSession = await auth.api.getSession({
      headers: new Headers({ cookie: staleCookie }),
    });
    expect(staleSession).toBeNull();

    // ...the old password no longer works, and the new one does.
    const oldPassword = await auth.api.signInEmail({
      asResponse: true,
      body: { email: "reset@example.com", password },
    });
    expect(oldPassword.status).toBe(401);
    const cookie = await signIn("reset@example.com", newPassword);
    expect(cookie.length).toBeGreaterThan(0);
  });

  it("changes email by confirming from the old address then verifying the new one", async () => {
    await registerAndVerify("old@example.com");
    const cookie = await signIn("old@example.com");

    await auth.api.changeEmail({
      body: { newEmail: "changed@example.com" },
      headers: new Headers({ cookie }),
    });

    // The confirmation goes to the current address, which must approve the move.
    const confirmation = inbox.latest("change");
    expect(confirmation?.to).toBe("old@example.com");

    // Approving it sends a verification to the *new* address.
    await auth.api.verifyEmail({
      headers: new Headers({ cookie }),
      query: { token: tokenFromUrl(confirmation?.url ?? "") },
    });
    const verification = inbox.latest("verify");
    expect(verification?.to).toBe("changed@example.com");

    // Only after the new address is verified does the account move.
    await auth.api.verifyEmail({
      query: { token: tokenFromUrl(verification?.url ?? "") },
    });
    const user = await client.user.findFirst();
    expect(user?.email).toBe("changed@example.com");
    expect(user?.emailVerified).toBe(true);
  });

  it("only deletes an account after the emailed token is presented", async () => {
    await registerAndVerify("delete@example.com");
    const cookie = await signIn("delete@example.com");

    const requested = await auth.api.deleteUser({
      body: {},
      headers: new Headers({ cookie }),
    });
    expect(requested.message).toBe("Verification email sent");

    // A bare session request does not destroy the account on its own.
    expect(await client.user.count()).toBe(1);
    const deletion = inbox.latest("delete");
    expect(deletion?.to).toBe("delete@example.com");

    const confirmed = await auth.api.deleteUser({
      body: { token: tokenFromUrl(deletion?.url ?? "") },
      headers: new Headers({ cookie }),
    });
    expect(confirmed.success).toBe(true);
    expect(await client.user.count()).toBe(0);
  });
});

describe("session management", () => {
  it("lists a session that is older than Better Auth's default freshness window", async () => {
    // Better Auth gates `/list-sessions` behind `freshSessionMiddleware`, whose
    // default window is 24 hours — so without a deliberate setting the settings
    // screen's device list would answer FORBIDDEN for anyone who signed in
    // yesterday, which is most people. Backdating the row is what proves the
    // configuration rather than the passage of time.
    await registerAndVerify("stale@example.com");
    const cookie = await signIn("stale@example.com");
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await client.session.updateMany({ data: { createdAt: twoDaysAgo } });

    const sessions = await auth.api.listSessions({
      headers: new Headers({ cookie }),
    });

    expect(sessions.length).toBeGreaterThan(0);
  });

  it("revokes one named session and leaves the caller's own signed in", async () => {
    await registerAndVerify("devices@example.com");
    const first = await signIn("devices@example.com");
    const second = await signIn("devices@example.com");

    const listed = await auth.api.listSessions({
      headers: new Headers({ cookie: second }),
    });
    // Verifying the address signs the account in as well, so more than two
    // sessions exist: the one to revoke has to be named, not merely "the other".
    const target = listed.find((session) => first.includes(session.token));
    expect(target).toBeDefined();

    await auth.api.revokeSession({
      body: { token: target?.token ?? "" },
      headers: new Headers({ cookie: second }),
    });

    expect(
      await auth.api.getSession({ headers: new Headers({ cookie: first }) }),
    ).toBeNull();
    expect(
      await auth.api.getSession({ headers: new Headers({ cookie: second }) }),
    ).not.toBeNull();
  });

  it("changes the password, re-issues the caller's session, and drops the others", async () => {
    await registerAndVerify("rotate@example.com");
    const stale = await signIn("rotate@example.com");
    const current = await signIn("rotate@example.com");

    // Asking to revoke the other devices deletes *every* session, the caller's
    // included, and issues a replacement in the response. A browser or the Expo
    // client follows that `Set-Cookie` and stays signed in without noticing;
    // anything driving the API by hand has to adopt the new cookie.
    const response = await auth.api.changePassword({
      asResponse: true,
      body: {
        currentPassword: password,
        newPassword,
        revokeOtherSessions: true,
      },
      headers: new Headers({ cookie: current }),
    });
    const reissued = sessionCookie(response);

    expect(reissued).not.toBe("");
    expect(reissued).not.toBe(current);
    expect(
      await auth.api.getSession({ headers: new Headers({ cookie: stale }) }),
    ).toBeNull();
    expect(
      await auth.api.getSession({ headers: new Headers({ cookie: reissued }) }),
    ).not.toBeNull();
    // The new secret is what works from here; the old one is spent.
    const refused = await auth.api.signInEmail({
      asResponse: true,
      body: { email: "rotate@example.com", password },
    });
    expect(refused.status).toBe(401);
    expect(await signIn("rotate@example.com", newPassword)).not.toBe("");
  });
});
