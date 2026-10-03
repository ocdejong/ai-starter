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

describe("PostgreSQL integrity", () => {
  let client: PrismaClient;

  beforeAll(async () => {
    client = createDatabaseClient(inject("databaseUrl"));
  });

  afterEach(async () => {
    await client.member.deleteMany();
    await client.organization.deleteMany();
    await client.user.deleteMany();
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("enforces unique email addresses", async () => {
    await createUser(client, "user-1", "same@example.com");

    await expect(
      createUser(client, "user-2", "same@example.com"),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("enforces foreign keys", async () => {
    await createUser(client, "user-1", "fk@example.com");
    await createGroup(client, "group-1");

    await expect(
      client.member.create({
        data: {
          createdAt: new Date(),
          id: "member-1",
          organizationId: "missing-group",
          role: "owner",
          userId: "user-1",
        },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("enforces SQL check constraints independently of Zod", async () => {
    // `groupNamePolicy` trims and refuses this, and `personalGroupName` falls
    // back to the address rather than writing it — but both guard the
    // application. A direct write has to meet the same rule, and only the
    // database can hold that line.
    await expect(
      client.organization.create({
        data: {
          createdAt: new Date(),
          id: "blank",
          name: "   ",
          slug: "blank",
        },
      }),
    ).rejects.toThrow();
  });

  it("rolls back all writes when a transaction fails", async () => {
    await createUser(client, "user-1", "transaction@example.com");

    await expect(
      client.$transaction(async (transaction) => {
        await createGroup(transaction, "group-1");
        await transaction.member.create({
          data: {
            createdAt: new Date(),
            id: "member-1",
            organizationId: "group-1",
            role: "owner",
            userId: "user-1",
          },
        });
        throw new Error("Abort transaction");
      }),
    ).rejects.toThrow("Abort transaction");

    await expect(client.organization.count()).resolves.toBe(0);
    await expect(client.member.count()).resolves.toBe(0);
  });
});

/**
 * Takes the transaction client as well as the singleton, because the rollback
 * case has to write *inside* a transaction — and Prisma's transactional client
 * is a narrower type than `PrismaClient`.
 */
function createGroup(client: Pick<PrismaClient, "organization">, id: string) {
  return client.organization.create({
    data: { createdAt: new Date(), id, name: id, slug: id },
  });
}

function createUser(client: PrismaClient, id: string, email: string) {
  return client.user.create({
    data: { id, email, name: "Test User" },
  });
}
