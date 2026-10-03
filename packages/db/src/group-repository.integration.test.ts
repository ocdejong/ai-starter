import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  inject,
  it,
} from "vitest";

import type { PrismaClient } from "../generated/prisma";
import { createDatabaseClient } from "./client";
import { createPrismaGroupRepository } from "./group-repository";

describe("group repository against PostgreSQL", () => {
  let client: PrismaClient;
  let groups: ReturnType<typeof createPrismaGroupRepository>;

  beforeAll(async () => {
    client = createDatabaseClient(inject("databaseUrl"));
    groups = createPrismaGroupRepository(client);
  });

  afterEach(async () => {
    await client.member.deleteMany();
    await client.organization.deleteMany();
    await client.user.deleteMany();
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("answers only for the group the user is actually a member of", async () => {
    await seedGroup(client, "group-a", "user-a");
    await seedGroup(client, "group-b", "user-b");

    // This lookup is the whole authorization decision behind `groupProcedure`.
    // If it ever answered for a group the user does not belong to, a stale or
    // tampered active-group id would become a cross-group read.
    await expect(
      groups.findMembership({ groupId: "group-a", userId: "user-a" }),
    ).resolves.toMatchObject({ groupId: "group-a", role: "owner" });
    await expect(
      groups.findMembership({ groupId: "group-b", userId: "user-a" }),
    ).resolves.toBeNull();
  });

  it("lists only the members of the group it was asked about", async () => {
    await seedGroup(client, "group-a", "user-a");
    await seedGroup(client, "group-b", "user-b");

    const members = await groups.listMembers("group-a");

    expect(members.map((member) => member.userId)).toEqual(["user-a"]);
  });

  it("lists only the groups the user belongs to", async () => {
    await seedGroup(client, "group-a", "user-a");
    await seedGroup(client, "group-b", "user-b");

    const memberships = await groups.listMemberships("user-a");

    expect(memberships.map((membership) => membership.groupId)).toEqual([
      "group-a",
    ]);
  });

  it("refuses a second membership row for the same user and group", async () => {
    await seedGroup(client, "group-a", "user-a");

    await expect(
      client.member.create({
        data: {
          createdAt: new Date(),
          id: "member-duplicate",
          organizationId: "group-a",
          role: "member",
          userId: "user-a",
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("removes memberships with the group they belong to", async () => {
    await seedGroup(client, "group-a", "user-a");

    await client.organization.delete({ where: { id: "group-a" } });

    expect(await client.member.count()).toBe(0);
  });
});

async function seedGroup(
  client: PrismaClient,
  groupId: string,
  userId: string,
): Promise<void> {
  await client.user.create({
    data: { email: `${userId}@example.com`, id: userId, name: userId },
  });
  await client.organization.create({
    data: { createdAt: new Date(), id: groupId, name: groupId, slug: groupId },
  });
  await client.member.create({
    data: {
      createdAt: new Date(),
      id: `member-${groupId}-${userId}`,
      organizationId: groupId,
      role: "owner",
      userId,
    },
  });
}
