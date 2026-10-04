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

/** What every personal group's slug starts with; the rest is its owner's user id. */
const personalSlugPrefix = "personal-";

/**
 * Slugs are globally unique, so the personal group derives its own from the
 * user id rather than the email: two people can share a local part across
 * domains, and deriving from that would make the second sign-up fail.
 */
function personalGroupSlug(userId: string): string {
  return `${personalSlugPrefix}${userId}`;
}

/**
 * Whose personal group this is, or `null` for any other group.
 *
 * The slug names the owner, but a slug alone is not proof — `groupSlug` can
 * produce a `personal-…` slug for an ordinary group someone happened to name
 * "personal" — so it counts only when the user it names is a member.
 */
export async function personalGroupOwnerId(
  database: Database,
  groupId: string,
): Promise<string | null> {
  const group = await database.organization.findUnique({
    select: { slug: true },
    where: { id: groupId },
  });
  if (!group?.slug.startsWith(personalSlugPrefix)) {
    return null;
  }

  const ownerId = group.slug.slice(personalSlugPrefix.length);
  const membership = await database.member.findFirst({
    select: { id: true },
    where: { organizationId: groupId, userId: ownerId },
  });
  return membership === null ? null : ownerId;
}

/**
 * Gives an account the group it owns, so no signed-in user ever has nowhere to
 * be, and returns its id. It is idempotent: it runs after sign-up and again
 * whenever a session finds the account with no group at all, so a second call —
 * or a concurrent one — must find the first one's group rather than make
 * another. Written through the injected client in one transaction: a group
 * without its owner's membership would be unreachable.
 */
export async function createPersonalGroup(
  database: Database,
  user: { readonly id: string; readonly name: string; readonly email: string },
): Promise<string> {
  try {
    return await persistPersonalGroup(database, user);
  } catch (error) {
    // Prisma implements an upsert as read-then-write, so two transactions that
    // both read "absent" race to insert and one hits the unique slug. Once the
    // other commits, a second attempt reads the group it made and completes
    // the membership upsert without creating a second group.
    if (!isUniqueConstraintViolation(error)) {
      throw error;
    }
    return persistPersonalGroup(database, user);
  }
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

async function persistPersonalGroup(
  database: Database,
  user: { readonly id: string; readonly name: string; readonly email: string },
): Promise<string> {
  const createdAt = new Date();
  const slug = personalGroupSlug(user.id);

  return database.$transaction(async (transaction) => {
    const organization = await transaction.organization.upsert({
      create: {
        createdAt,
        id: randomUUID(),
        name: personalGroupName(user),
        slug,
      },
      update: {},
      where: { slug },
    });
    await transaction.member.upsert({
      create: {
        createdAt,
        id: randomUUID(),
        organizationId: organization.id,
        role: groupOwnerRole,
        userId: user.id,
      },
      update: {},
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: user.id,
        },
      },
    });
    return organization.id;
  });
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
