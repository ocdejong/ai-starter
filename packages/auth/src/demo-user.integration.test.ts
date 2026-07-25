import type { Database } from "@ai-starter/db";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  createEmailInbox,
  startAuthHarness,
  type EmailInbox,
} from "../test/harness";
import { demoUser, seedDemoUser } from "./demo-user";
import type { Auth } from "./init-auth";

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

describe("seedDemoUser", () => {
  it("creates a verified account the app's own auth instance signs in", async () => {
    await expect(seedDemoUser(client)).resolves.toBe("created");

    // The harness auth uses its own secret, so this proves the seeded rows —
    // password hash included — are what any Better Auth instance expects, not
    // just the one the seed built internally.
    const signedIn = await auth.api.signInEmail({
      body: { email: demoUser.email, password: demoUser.password },
    });
    expect(signedIn.user.email).toBe(demoUser.email);

    const user = await client.user.findUniqueOrThrow({
      where: { email: demoUser.email },
    });
    expect(user.emailVerified).toBe(true);
  });

  it("gives the demo account its personal group with the owner role", async () => {
    await seedDemoUser(client);

    const user = await client.user.findUniqueOrThrow({
      where: { email: demoUser.email },
    });
    const membership = await client.member.findFirstOrThrow({
      include: { organization: true },
      where: { userId: user.id },
    });
    expect(membership.role).toBe("owner");
    expect(membership.organization.slug).toBe(`personal-${user.id}`);
  });

  it("creates nothing new when run again", async () => {
    await seedDemoUser(client);
    await expect(seedDemoUser(client)).resolves.toBe("already-seeded");

    expect(await client.user.count()).toBe(1);
    expect(await client.account.count()).toBe(1);
    expect(await client.organization.count()).toBe(1);
    expect(await client.member.count()).toBe(1);
  });

  it("completes verification when an earlier run stopped before confirming", async () => {
    // The half-state an interrupted seed leaves behind: signed up, unverified.
    await auth.api.signUpEmail({ body: { ...demoUser } });

    await expect(seedDemoUser(client)).resolves.toBe("verification-completed");

    const signedIn = await auth.api.signInEmail({
      body: { email: demoUser.email, password: demoUser.password },
    });
    expect(signedIn.user.email).toBe(demoUser.email);
  });
});
