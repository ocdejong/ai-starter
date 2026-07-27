import { randomUUID } from "node:crypto";

import type { Database } from "@ai-starter/db";

/**
 * The role Better Auth gives whoever created a group, and the role the seeded
 * personal group grants its owner. Named once so the factory's `creatorRole`
 * and the seeding hook cannot drift apart.
 */
export const groupOwnerRole = "owner";

/**
 * The personal group's display name. It is a row in the database, not a
 * rendered string, so it cannot come from the message catalogs: using the
 * person's own name keeps it language-neutral and recognisable. A blank name
 * falls back to the address the account was opened with.
 */
function personalGroupName(user: {
  readonly name: string;
  readonly email: string;
}): string {
  return user.name.trim() === "" ? user.email : user.name.trim();
}

/**
 * Slugs are globally unique, so the personal group derives its own from the
 * user id rather than the email: two people can share a local part across
 * domains, and deriving from that would make the second sign-up fail.
 */
function personalGroupSlug(userId: string): string {
  return `personal-${userId}`;
}

/**
 * Gives a brand-new account the group it owns, so no signed-in user ever has
 * nowhere to be. Written through the injected client in one transaction: a
 * group without its owner's membership would be unreachable.
 */
export async function createPersonalGroup(
  database: Database,
  user: { readonly id: string; readonly name: string; readonly email: string },
): Promise<void> {
  const createdAt = new Date();
  const organizationId = randomUUID();

  await database.$transaction([
    database.organization.create({
      data: {
        createdAt,
        id: organizationId,
        name: personalGroupName(user),
        slug: personalGroupSlug(user.id),
      },
    }),
    database.member.create({
      data: {
        createdAt,
        id: randomUUID(),
        organizationId,
        role: groupOwnerRole,
        userId: user.id,
      },
    }),
  ]);
}

/**
 * The group a fresh session starts in: the oldest one the user belongs to,
 * which is the personal group unless they have since left it.
 */
async function firstGroupIdFor(
  database: Database,
  userId: string,
): Promise<string | null> {
  const membership = await database.member.findFirst({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { organizationId: true },
    where: { userId },
  });

  return membership?.organizationId ?? null;
}

/**
 * The group a new session is seeded with. `carriedGroupId` is the active group
 * of the session the caller presented — a replacement session (a password
 * change that revokes the others) should keep the user where they were working
 * rather than dropping them back into their first group. It is a hint, not an
 * authorization: the value travelled in a session row and may be stale or
 * forged, so it is honoured only after the membership is confirmed to exist.
 * Without one, the first group applies.
 */
export async function seedGroupIdFor(
  database: Database,
  userId: string,
  carriedGroupId: string | null,
): Promise<string | null> {
  if (carriedGroupId !== null) {
    const membership = await database.member.findFirst({
      select: { organizationId: true },
      where: { organizationId: carriedGroupId, userId },
    });
    if (membership !== null) {
      return membership.organizationId;
    }
  }

  return firstGroupIdFor(database, userId);
}

/**
 * Removes the groups that only this user belongs to, before the account is
 * deleted. The membership rows cascade with the user, which would otherwise
 * leave their personal group standing with nobody able to reach it. Groups with
 * other members survive — losing one member is not the same as losing a group.
 */
export async function deleteSoleMemberGroups(
  database: Database,
  userId: string,
): Promise<void> {
  await database.organization.deleteMany({
    where: { members: { every: { userId }, some: { userId } } },
  });
}
