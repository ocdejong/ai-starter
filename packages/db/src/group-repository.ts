import "server-only";

import type { Database } from "./client";

const groupFields = { id: true, name: true, slug: true } as const;

/**
 * Reads groups and memberships for the API layer's group contract. It is built
 * from an injected client so an integration test can bind it to a throwaway
 * container; the composition root passes the shared singleton.
 *
 * Every lookup is keyed by the user as well as the group. There is no "read a
 * group" call that skips membership, so the layer above cannot accidentally ask
 * one.
 */
export const createPrismaGroupRepository = (database: Database) => ({
  findMembership: async ({
    groupId,
    userId,
  }: {
    groupId: string;
    userId: string;
  }) => {
    const membership = await database.member.findUnique({
      select: { organization: { select: groupFields }, role: true },
      where: { organizationId_userId: { organizationId: groupId, userId } },
    });

    return membership === null
      ? null
      : {
          groupId: membership.organization.id,
          name: membership.organization.name,
          role: membership.role,
          slug: membership.organization.slug,
        };
  },

  listMemberships: async (userId: string) => {
    const memberships = await database.member.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { organization: { select: groupFields }, role: true },
      where: { userId },
    });

    return memberships.map((membership) => ({
      groupId: membership.organization.id,
      name: membership.organization.name,
      role: membership.role,
      slug: membership.organization.slug,
    }));
  },

  listMembers: async (groupId: string) => {
    const members = await database.member.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        role: true,
        user: { select: { email: true, name: true } },
        userId: true,
      },
      where: { organizationId: groupId },
    });

    return members.map((member) => ({
      email: member.user.email,
      id: member.id,
      name: member.user.name,
      role: member.role,
      userId: member.userId,
    }));
  },
});
