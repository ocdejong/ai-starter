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
