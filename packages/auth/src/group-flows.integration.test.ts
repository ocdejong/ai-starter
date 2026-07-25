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

/** Registers, verifies the address, signs in, and returns the request headers. */
async function signedInUser(email: string, name = "Test Person") {
  await auth.api.signUpEmail({ body: { email, name, password } });
  const verification = inbox.latest("verify");
  if (verification === undefined) {
    throw new Error(`no verification email was captured for ${email}`);
  }
  await auth.api.verifyEmail({
    query: { token: tokenFromUrl(verification.url) },
  });
  const response = await auth.api.signInEmail({
    asResponse: true,
    body: { email, password },
  });
  return new Headers({ cookie: sessionCookie(response) });
}

/** The active group id as the server currently sees it, cache bypassed. */
async function activeGroupId(headers: Headers): Promise<string | null> {
  const session = await auth.api.getSession({
    headers,
    query: { disableCookieCache: true },
  });
  return session?.session.activeOrganizationId ?? null;
}

describe("personal group", () => {
  it("gives every new account a group it owns and makes it active", async () => {
    const headers = await signedInUser("owner@example.com", "Ada Lovelace");

    const groups = await auth.api.listOrganizations({ headers });
    expect(groups).toHaveLength(1);
    expect(groups[0]?.name).toBe("Ada Lovelace");

    // The dashboard must never meet a null group.
    expect(await activeGroupId(headers)).toBe(groups[0]?.id);

    const membership = await client.member.findFirstOrThrow();
    expect(membership.role).toBe("owner");
  });

  it("keeps personal slugs distinct for the same local part on two domains", async () => {
    await signedInUser("olivier@one.example", "Olivier One");
    await signedInUser("olivier@two.example", "Olivier Two");

    const slugs = (await client.organization.findMany()).map(
      (group) => group.slug,
    );
    expect(new Set(slugs).size).toBe(2);
  });

  it("takes the personal group with it when the account is deleted", async () => {
    const headers = await signedInUser("leaving@example.com");
    expect(await client.organization.count()).toBe(1);

    await auth.api.deleteUser({ body: {}, headers });
    const deletion = inbox.latest("delete");
    await auth.api.deleteUser({
      body: { token: tokenFromUrl(deletion?.url ?? "") },
      headers,
    });

    expect(await client.user.count()).toBe(0);
    // A group nobody can reach is a leak, not a record.
    expect(await client.organization.count()).toBe(0);
  });

  it("leaves a shared group standing when one of its members deletes their account", async () => {
    const ownerHeaders = await signedInUser("keeper@example.com");
    const shared = await auth.api.createOrganization({
      body: { name: "Shared", slug: "shared" },
      headers: ownerHeaders,
    });
    const guestHeaders = await signedInUser("guest@example.com");
    await joinGroup(shared?.id ?? "", ownerHeaders, "guest@example.com", {
      as: guestHeaders,
    });

    await auth.api.deleteUser({ body: {}, headers: guestHeaders });
    await auth.api.deleteUser({
      body: { token: tokenFromUrl(inbox.latest("delete")?.url ?? "") },
      headers: guestHeaders,
    });

    expect(
      await client.organization.findUnique({ where: { id: shared?.id ?? "" } }),
    ).not.toBeNull();
  });
});

describe("group membership flows", () => {
  it("creates a group whose creator owns it and can be switched to", async () => {
    const headers = await signedInUser("creator@example.com");

    const created = await auth.api.createOrganization({
      body: { name: "Team Rocket", slug: "team-rocket" },
      headers,
    });
    expect(created?.id).toBeDefined();

    await auth.api.setActiveOrganization({
      body: { organizationId: created?.id ?? null },
      headers,
    });
    expect(await activeGroupId(headers)).toBe(created?.id);

    const membership = await client.member.findFirstOrThrow({
      where: { organizationId: created?.id ?? "" },
    });
    expect(membership.role).toBe("owner");
  });

  it("invites by email, mails an accept link, and admits the invitee", async () => {
    const ownerHeaders = await signedInUser("host@example.com");
    const group = await auth.api.createOrganization({
      body: { name: "Book Club", slug: "book-club" },
      headers: ownerHeaders,
    });

    const invitation = await auth.api.createInvitation({
      body: {
        email: "reader@example.com",
        organizationId: group?.id ?? "",
        role: "member",
      },
      headers: ownerHeaders,
    });

    const sent = inbox.latestInvitation();
    expect(sent?.to).toBe("reader@example.com");
    expect(sent?.invitationId).toBe(invitation.id);

    const guestHeaders = await signedInUser("reader@example.com");
    await auth.api.acceptInvitation({
      body: { invitationId: invitation.id },
      headers: guestHeaders,
    });

    const members = await client.member.findMany({
      where: { organizationId: group?.id ?? "" },
    });
    expect(members).toHaveLength(2);
    expect(
      members.find((member) => member.role === "member"),
    ).not.toBeUndefined();
  });

  it("refuses an invitation whose window has closed", async () => {
    const ownerHeaders = await signedInUser("late@example.com");
    const group = await auth.api.createOrganization({
      body: { name: "Late Club", slug: "late-club" },
      headers: ownerHeaders,
    });
    const invitation = await auth.api.createInvitation({
      body: {
        email: "slow@example.com",
        organizationId: group?.id ?? "",
        role: "member",
      },
      headers: ownerHeaders,
    });

    // Backdating the row is the deterministic way to reach the expiry branch.
    await client.invitation.update({
      data: { expiresAt: new Date(Date.now() - 1000) },
      where: { id: invitation.id },
    });

    const guestHeaders = await signedInUser("slow@example.com");
    // An expired invitation is reported as a missing one, so a stale link never
    // confirms that the group — or the invitation — exists.
    await expect(
      auth.api.acceptInvitation({
        body: { invitationId: invitation.id },
        headers: guestHeaders,
      }),
    ).rejects.toMatchObject({
      body: { code: "INVITATION_NOT_FOUND" },
      status: "BAD_REQUEST",
    });
    expect(
      await client.member.count({ where: { organizationId: group?.id ?? "" } }),
    ).toBe(1);
  });

  it("refuses an invitation the recipient has not proved the address for", async () => {
    const ownerHeaders = await signedInUser("proof@example.com");
    const group = await auth.api.createOrganization({
      body: { name: "Proof Club", slug: "proof-club" },
      headers: ownerHeaders,
    });
    const invitation = await auth.api.createInvitation({
      body: {
        email: "unproven@example.com",
        organizationId: group?.id ?? "",
        role: "member",
      },
      headers: ownerHeaders,
    });

    // Sign-in already requires a verified address, so the only way to hold a
    // session with an unverified one is for verification to be revoked after
    // the fact. That is the case `requireEmailVerificationOnInvitation` exists
    // for: the invitation id alone must never be enough to join.
    const guestHeaders = await signedInUser("unproven@example.com");
    await client.user.update({
      data: { emailVerified: false },
      where: { email: "unproven@example.com" },
    });

    await expect(
      auth.api.acceptInvitation({
        body: { invitationId: invitation.id },
        headers: guestHeaders,
      }),
    ).rejects.toMatchObject({
      body: {
        code: "EMAIL_VERIFICATION_REQUIRED_BEFORE_ACCEPTING_OR_REJECTING_INVITATION",
      },
      status: "FORBIDDEN",
    });
    expect(
      await client.member.count({ where: { organizationId: group?.id ?? "" } }),
    ).toBe(1);
  });

  it("cancels the pending invitation when the same address is invited again", async () => {
    const ownerHeaders = await signedInUser("again@example.com");
    const group = await auth.api.createOrganization({
      body: { name: "Repeat", slug: "repeat" },
      headers: ownerHeaders,
    });
    const body = {
      email: "twice@example.com",
      organizationId: group?.id ?? "",
      role: "member" as const,
    };

    const first = await auth.api.createInvitation({
      body,
      headers: ownerHeaders,
    });
    const second = await auth.api.createInvitation({
      body,
      headers: ownerHeaders,
    });

    expect(second.id).not.toBe(first.id);
    const invitations = await client.invitation.findMany({
      where: { organizationId: group?.id ?? "" },
    });
    expect(
      invitations.filter((invitation) => invitation.status === "pending"),
    ).toHaveLength(1);
    expect(
      invitations.find((invitation) => invitation.id === first.id)?.status,
    ).toBe("canceled");
  });

  it("promotes a member, removes another, and lets a third leave", async () => {
    const ownerHeaders = await signedInUser("chief@example.com");
    const group = await auth.api.createOrganization({
      body: { name: "Crew", slug: "crew" },
      headers: ownerHeaders,
    });
    const groupId = group?.id ?? "";

    const promotedHeaders = await signedInUser("promoted@example.com");
    await joinGroup(groupId, ownerHeaders, "promoted@example.com", {
      as: promotedHeaders,
    });
    const removedHeaders = await signedInUser("removed@example.com");
    await joinGroup(groupId, ownerHeaders, "removed@example.com", {
      as: removedHeaders,
    });
    const leavingHeaders = await signedInUser("leaving@example.com");
    await joinGroup(groupId, ownerHeaders, "leaving@example.com", {
      as: leavingHeaders,
    });

    const promoted = await client.member.findFirstOrThrow({
      where: {
        organizationId: groupId,
        user: { email: "promoted@example.com" },
      },
    });
    await auth.api.updateMemberRole({
      body: { memberId: promoted.id, organizationId: groupId, role: "admin" },
      headers: ownerHeaders,
    });
    expect(
      (await client.member.findUniqueOrThrow({ where: { id: promoted.id } }))
        .role,
    ).toBe("admin");

    await auth.api.removeMember({
      body: { memberIdOrEmail: "removed@example.com", organizationId: groupId },
      headers: ownerHeaders,
    });
    await auth.api.leaveOrganization({
      body: { organizationId: groupId },
      headers: leavingHeaders,
    });

    const remaining = await client.member.findMany({
      where: { organizationId: groupId },
      include: { user: { select: { email: true } } },
    });
    expect(remaining.map((member) => member.user.email).sort()).toEqual([
      "chief@example.com",
      "promoted@example.com",
    ]);
  });

  it("lets only the owner delete a group", async () => {
    const ownerHeaders = await signedInUser("boss@example.com");
    const group = await auth.api.createOrganization({
      body: { name: "Fragile", slug: "fragile" },
      headers: ownerHeaders,
    });
    const groupId = group?.id ?? "";
    const memberHeaders = await signedInUser("underling@example.com");
    await joinGroup(groupId, ownerHeaders, "underling@example.com", {
      as: memberHeaders,
    });

    await expect(
      auth.api.deleteOrganization({
        body: { organizationId: groupId },
        headers: memberHeaders,
      }),
    ).rejects.toMatchObject({
      body: { code: "YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_ORGANIZATION" },
      status: "FORBIDDEN",
    });
    expect(await client.organization.count({ where: { id: groupId } })).toBe(1);

    await auth.api.deleteOrganization({
      body: { organizationId: groupId },
      headers: ownerHeaders,
    });
    expect(await client.organization.count({ where: { id: groupId } })).toBe(0);
    // The group's memberships go with it rather than dangling.
    expect(
      await client.member.count({ where: { organizationId: groupId } }),
    ).toBe(0);
  });

  it("reports a second acceptance of the same invitation as a missing one", async () => {
    const ownerHeaders = await signedInUser("twice-host@example.com");
    const group = await auth.api.createOrganization({
      body: { name: "Once", slug: "once" },
      headers: ownerHeaders,
    });
    const invitation = await auth.api.createInvitation({
      body: {
        email: "eager@example.com",
        organizationId: group?.id ?? "",
        role: "member",
      },
      headers: ownerHeaders,
    });
    const guestHeaders = await signedInUser("eager@example.com");
    await auth.api.acceptInvitation({
      body: { invitationId: invitation.id },
      headers: guestHeaders,
    });

    // Accepting again is how a recipient who is already a member reaches this
    // link, and it answers exactly as an expired one does — so the accept page
    // has a single "no longer valid" state rather than a reachable
    // already-a-member state it could never actually render.
    await expect(
      auth.api.acceptInvitation({
        body: { invitationId: invitation.id },
        headers: guestHeaders,
      }),
    ).rejects.toMatchObject({
      body: { code: "INVITATION_NOT_FOUND" },
      status: "BAD_REQUEST",
    });
  });
});

/**
 * A group always has an owner.
 *
 * The last owner of a group cannot leave it, cannot be removed from it and
 * cannot be demoted out of it: the only way out is to hand ownership to someone
 * else first, or to delete the group. That answers what happens to a group whose
 * last owner leaves — it never becomes ownerless, so nothing has to inherit it
 * and no unowned group can accumulate. The affordances the settings screens
 * render follow from these three refusals, and they are refusals of the server,
 * not of the user interface.
 */
describe("group ownership", () => {
  it("refuses to let the only owner leave the group", async () => {
    const ownerHeaders = await signedInUser("sole@example.com");
    const group = await auth.api.createOrganization({
      body: { name: "Solo", slug: "solo" },
      headers: ownerHeaders,
    });
    const groupId = group?.id ?? "";
    const memberHeaders = await signedInUser("bystander@example.com");
    await joinGroup(groupId, ownerHeaders, "bystander@example.com", {
      as: memberHeaders,
    });

    await expect(
      auth.api.leaveOrganization({
        body: { organizationId: groupId },
        headers: ownerHeaders,
      }),
    ).rejects.toMatchObject({
      body: { code: "YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER" },
      status: "BAD_REQUEST",
    });
    expect(
      await client.member.count({ where: { organizationId: groupId } }),
    ).toBe(2);
  });

  it("refuses to demote or remove the only owner", async () => {
    const ownerHeaders = await signedInUser("keeper2@example.com");
    const group = await auth.api.createOrganization({
      body: { name: "Kept", slug: "kept" },
      headers: ownerHeaders,
    });
    const groupId = group?.id ?? "";
    const owner = await client.member.findFirstOrThrow({
      where: {
        organizationId: groupId,
        user: { email: "keeper2@example.com" },
      },
    });

    await expect(
      auth.api.updateMemberRole({
        body: { memberId: owner.id, organizationId: groupId, role: "member" },
        headers: ownerHeaders,
      }),
    ).rejects.toMatchObject({
      body: { code: "YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER" },
      status: "BAD_REQUEST",
    });
    await expect(
      auth.api.removeMember({
        body: {
          memberIdOrEmail: "keeper2@example.com",
          organizationId: groupId,
        },
        headers: ownerHeaders,
      }),
    ).rejects.toMatchObject({
      body: { code: "YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER" },
      status: "BAD_REQUEST",
    });
    expect(
      (await client.member.findUniqueOrThrow({ where: { id: owner.id } })).role,
    ).toBe("owner");
  });

  it("lets the outgoing owner leave once someone else owns the group", async () => {
    const ownerHeaders = await signedInUser("handover@example.com");
    const group = await auth.api.createOrganization({
      body: { name: "Handover", slug: "handover" },
      headers: ownerHeaders,
    });
    const groupId = group?.id ?? "";
    const successorHeaders = await signedInUser("successor@example.com");
    await joinGroup(groupId, ownerHeaders, "successor@example.com", {
      as: successorHeaders,
    });
    const successor = await client.member.findFirstOrThrow({
      where: {
        organizationId: groupId,
        user: { email: "successor@example.com" },
      },
    });

    await auth.api.updateMemberRole({
      body: { memberId: successor.id, organizationId: groupId, role: "owner" },
      headers: ownerHeaders,
    });
    await auth.api.leaveOrganization({
      body: { organizationId: groupId },
      headers: ownerHeaders,
    });

    const remaining = await client.member.findMany({
      where: { organizationId: groupId },
      include: { user: { select: { email: true } } },
    });
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.user.email).toBe("successor@example.com");
    expect(remaining[0]?.role).toBe("owner");
  });

  it("leaves the departing member without an active group", async () => {
    const ownerHeaders = await signedInUser("host2@example.com");
    const group = await auth.api.createOrganization({
      body: { name: "Transit", slug: "transit" },
      headers: ownerHeaders,
    });
    const groupId = group?.id ?? "";
    const guestHeaders = await signedInUser("transient@example.com");
    await joinGroup(groupId, ownerHeaders, "transient@example.com", {
      as: guestHeaders,
    });
    // Accepting an invitation switches to the group it was for.
    expect(await activeGroupId(guestHeaders)).toBe(groupId);

    await auth.api.leaveOrganization({
      body: { organizationId: groupId },
      headers: guestHeaders,
    });

    // Leaving the active group clears it, so the client is responsible for
    // choosing the next one; a request made in between has no group at all.
    expect(await activeGroupId(guestHeaders)).toBeNull();
  });

  it("refuses an admin the owner role, both to invite with and to assign", async () => {
    const ownerHeaders = await signedInUser("founder@example.com");
    const group = await auth.api.createOrganization({
      body: { name: "Ladder", slug: "ladder" },
      headers: ownerHeaders,
    });
    const groupId = group?.id ?? "";
    const adminHeaders = await signedInUser("deputy@example.com");
    await joinGroup(groupId, ownerHeaders, "deputy@example.com", {
      as: adminHeaders,
    });
    const deputy = await client.member.findFirstOrThrow({
      where: { organizationId: groupId, user: { email: "deputy@example.com" } },
    });
    await auth.api.updateMemberRole({
      body: { memberId: deputy.id, organizationId: groupId, role: "admin" },
      headers: ownerHeaders,
    });
    const colleagueHeaders = await signedInUser("colleague@example.com");
    await joinGroup(groupId, ownerHeaders, "colleague@example.com", {
      as: colleagueHeaders,
    });
    const colleague = await client.member.findFirstOrThrow({
      where: {
        organizationId: groupId,
        user: { email: "colleague@example.com" },
      },
    });

    // `assignableGroupRoles` in packages/domain withholds the owner role from an
    // admin; these are the refusals it mirrors, so the interface never offers a
    // role the server would reject.
    await expect(
      auth.api.createInvitation({
        body: {
          email: "heir@example.com",
          organizationId: groupId,
          role: "owner",
        },
        headers: adminHeaders,
      }),
    ).rejects.toMatchObject({
      body: { code: "YOU_ARE_NOT_ALLOWED_TO_INVITE_USER_WITH_THIS_ROLE" },
      status: "FORBIDDEN",
    });
    await expect(
      auth.api.updateMemberRole({
        body: {
          memberId: colleague.id,
          organizationId: groupId,
          role: "owner",
        },
        headers: adminHeaders,
      }),
    ).rejects.toMatchObject({
      body: { code: "YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_MEMBER" },
      status: "FORBIDDEN",
    });

    // The roles an admin may hand out are accepted, so the mirror is a rule and
    // not a coincidence of the owner role being special.
    await auth.api.updateMemberRole({
      body: { memberId: colleague.id, organizationId: groupId, role: "admin" },
      headers: adminHeaders,
    });
    expect(
      (await client.member.findUniqueOrThrow({ where: { id: colleague.id } }))
        .role,
    ).toBe("admin");
  });

  it("refuses a plain member every affordance the settings screen withholds", async () => {
    const ownerHeaders = await signedInUser("chief2@example.com");
    const group = await auth.api.createOrganization({
      body: { name: "Guarded", slug: "guarded" },
      headers: ownerHeaders,
    });
    const groupId = group?.id ?? "";
    const memberHeaders = await signedInUser("plain@example.com");
    await joinGroup(groupId, ownerHeaders, "plain@example.com", {
      as: memberHeaders,
    });
    const owner = await client.member.findFirstOrThrow({
      where: { organizationId: groupId, user: { email: "chief2@example.com" } },
    });

    await expect(
      auth.api.createInvitation({
        body: {
          email: "outsider@example.com",
          organizationId: groupId,
          role: "member",
        },
        headers: memberHeaders,
      }),
    ).rejects.toMatchObject({
      body: {
        code: "YOU_ARE_NOT_ALLOWED_TO_INVITE_USERS_TO_THIS_ORGANIZATION",
      },
      status: "FORBIDDEN",
    });
    await expect(
      auth.api.updateMemberRole({
        body: { memberId: owner.id, organizationId: groupId, role: "member" },
        headers: memberHeaders,
      }),
    ).rejects.toMatchObject({
      body: { code: "YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_MEMBER" },
      status: "FORBIDDEN",
    });
    await expect(
      auth.api.removeMember({
        body: {
          memberIdOrEmail: "chief2@example.com",
          organizationId: groupId,
        },
        headers: memberHeaders,
      }),
    ).rejects.toMatchObject({
      body: { code: "YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER" },
      status: "BAD_REQUEST",
    });
    await expect(
      auth.api.updateOrganization({
        body: { data: { name: "Renamed" }, organizationId: groupId },
        headers: memberHeaders,
      }),
    ).rejects.toMatchObject({
      body: { code: "YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_ORGANIZATION" },
      status: "FORBIDDEN",
    });

    // The only invitation in the group is the accepted one that admitted the
    // member; nothing they attempted left a trace.
    expect(
      await client.invitation.count({ where: { status: "pending" } }),
    ).toBe(0);
    expect(
      (await client.organization.findUniqueOrThrow({ where: { id: groupId } }))
        .name,
    ).toBe("Guarded");
  });
});

/** Invites `email` to `groupId` and accepts it as the already signed-in guest. */
async function joinGroup(
  groupId: string,
  inviterHeaders: Headers,
  email: string,
  guest: { as: Headers },
): Promise<void> {
  const invitation = await auth.api.createInvitation({
    body: { email, organizationId: groupId, role: "member" },
    headers: inviterHeaders,
  });
  await auth.api.acceptInvitation({
    body: { invitationId: invitation.id },
    headers: guest.as,
  });
}
