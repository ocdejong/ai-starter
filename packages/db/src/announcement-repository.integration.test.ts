import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "../generated/prisma";
import { createDatabaseClient } from "./client";
import { createPrismaAnnouncementRepository } from "./announcement-repository";

const execFileAsync = promisify(execFile);
const packageDirectory = fileURLToPath(new URL("../", import.meta.url));
const schemaPath = fileURLToPath(
  new URL("../prisma/schema.prisma", import.meta.url),
);

describe("announcement repository against PostgreSQL", () => {
  let container: StartedPostgreSqlContainer;
  let client: PrismaClient;
  let announcements: ReturnType<typeof createPrismaAnnouncementRepository>;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:17-alpine").start();
    const databaseUrl = container.getConnectionUri();

    await execFileAsync(
      "pnpm",
      ["exec", "prisma", "migrate", "deploy", "--schema", schemaPath],
      {
        cwd: packageDirectory,
        env: { ...process.env, DATABASE_URL: databaseUrl },
      },
    );

    client = createDatabaseClient(databaseUrl);
    announcements = createPrismaAnnouncementRepository(client);
  }, 120_000);

  afterEach(async () => {
    await client.announcement.deleteMany();
    await client.member.deleteMany();
    await client.organization.deleteMany();
    await client.user.deleteMany();
  });

  afterAll(async () => {
    await client?.$disconnect();
    await container?.stop();
  });

  it("publishes into one group and lists nothing for another", async () => {
    await seedGroup(client, "group-a", "user-a");
    await seedGroup(client, "group-b", "user-b");

    await announcements.create({
      createdById: "user-a",
      groupId: "group-a",
      title: "The first announcement",
    });

    await expect(announcements.listByGroup("group-a")).resolves.toMatchObject([
      { isCurrent: true, title: "The first announcement" },
    ]);
    await expect(announcements.listByGroup("group-b")).resolves.toEqual([]);
  });

  it("supersedes the previous current announcement in one transaction", async () => {
    await seedGroup(client, "group-a", "user-a");

    const first = await announcements.create({
      createdById: "user-a",
      groupId: "group-a",
      title: "An earlier announcement",
    });
    const second = await announcements.create({
      createdById: "user-a",
      groupId: "group-a",
      title: "A second announcement",
    });

    const stored = await announcements.listByGroup("group-a");

    expect(stored.map((entry) => [entry.id, entry.isCurrent])).toEqual([
      [second.id, true],
      [first.id, false],
    ]);
  });

  it("lets each group keep its own current announcement", async () => {
    await seedGroup(client, "group-a", "user-a");
    await seedGroup(client, "group-b", "user-b");

    await announcements.create({
      createdById: "user-a",
      groupId: "group-a",
      title: "This group's announcement",
    });
    await announcements.create({
      createdById: "user-b",
      groupId: "group-b",
      title: "Another group's announcement",
    });

    await expect(announcements.listByGroup("group-a")).resolves.toMatchObject([
      { isCurrent: true, title: "This group's announcement" },
    ]);
    await expect(announcements.listByGroup("group-b")).resolves.toMatchObject([
      { isCurrent: true, title: "Another group's announcement" },
    ]);
  });

  it("refuses a second current announcement written around the transaction", async () => {
    await seedGroup(client, "group-a", "user-a");
    await announcements.create({
      createdById: "user-a",
      groupId: "group-a",
      title: "The first announcement",
    });

    // The partial unique index is what stands between a concurrent second
    // publisher and a group with two current announcements. The transaction
    // orders the writes; only the constraint can refuse a writer that never
    // read the first one.
    await expect(
      client.announcement.create({
        data: {
          createdById: "user-a",
          groupId: "group-a",
          isCurrent: true,
          title: "A second announcement",
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  // The bound lives in a CHECK constraint rather than the column type, and a
  // constraint violation reaches Prisma with no error code at all — so this
  // asserts the refusal itself, as the shared database integration test does.
  it("refuses a title past the length the constraint allows", async () => {
    await seedGroup(client, "group-a", "user-a");

    await expect(
      announcements.create({
        createdById: "user-a",
        groupId: "group-a",
        title: "x".repeat(121),
      }),
    ).rejects.toThrow();
  });

  it("renames only within the group that asked", async () => {
    await seedGroup(client, "group-a", "user-a");
    await seedGroup(client, "group-b", "user-b");
    const mine = await announcements.create({
      createdById: "user-a",
      groupId: "group-a",
      title: "This group's announcement",
    });

    // The identifier is real and the caller is a genuine member — of the wrong
    // group. Pairing it with the verified group is what turns a cross-group
    // write into no write at all.
    await expect(
      announcements.rename({
        announcementId: mine.id,
        groupId: "group-b",
        title: "Another group's announcement",
      }),
    ).resolves.toBeNull();
    await expect(
      announcements.rename({
        announcementId: mine.id,
        groupId: "group-a",
        title: "The renamed announcement",
      }),
    ).resolves.toMatchObject({ title: "The renamed announcement" });
  });

  it("loses its announcements when the group is deleted", async () => {
    await seedGroup(client, "group-a", "user-a");
    await announcements.create({
      createdById: "user-a",
      groupId: "group-a",
      title: "This group's announcement",
    });

    await client.organization.delete({ where: { id: "group-a" } });

    await expect(client.announcement.count()).resolves.toBe(0);
  });
});

async function seedGroup(
  client: PrismaClient,
  groupId: string,
  userId: string,
): Promise<void> {
  await client.user.create({
    data: {
      email: `${userId}@example.com`,
      id: userId,
      name: userId,
    },
  });
  await client.organization.create({
    data: { createdAt: new Date(), id: groupId, name: groupId, slug: groupId },
  });
  await client.member.create({
    data: {
      createdAt: new Date(),
      id: `${groupId}-${userId}`,
      organizationId: groupId,
      role: "owner",
      userId,
    },
  });
}
