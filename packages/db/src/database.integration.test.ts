import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "../generated/prisma";

const execFileAsync = promisify(execFile);
const packageDirectory = fileURLToPath(new URL("../", import.meta.url));
const schemaPath = fileURLToPath(
  new URL("../prisma/schema.prisma", import.meta.url),
);

describe("PostgreSQL integrity", () => {
  let container: StartedPostgreSqlContainer;
  let client: PrismaClient;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:17-alpine")
      .withDatabase("starter_test")
      .withUsername("postgres")
      .withPassword("postgres")
      .start();

    const databaseUrl = container.getConnectionUri();

    await execFileAsync(
      "pnpm",
      ["exec", "prisma", "migrate", "deploy", "--schema", schemaPath],
      {
        cwd: packageDirectory,
        env: { ...process.env, DATABASE_URL: databaseUrl },
      },
    );

    client = new PrismaClient({ datasourceUrl: databaseUrl });
  }, 120_000);

  afterEach(async () => {
    await client.announcement.deleteMany();
    await client.organization.deleteMany();
    await client.user.deleteMany();
  });

  afterAll(async () => {
    await client?.$disconnect();
    await container?.stop();
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
      client.announcement.create({
        data: {
          createdById: "user-1",
          groupId: "missing-group",
          title: "Orphan",
        },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("enforces SQL check constraints independently of Zod", async () => {
    await createUser(client, "user-1", "check@example.com");
    await createGroup(client, "group-1");

    // The domain schema trims and refuses this, but the schema only guards the
    // forms. A direct write has to meet the same rule, and only the database
    // can hold that line.
    await expect(
      client.announcement.create({
        data: { createdById: "user-1", groupId: "group-1", title: "   " },
      }),
    ).rejects.toThrow();
  });

  it("rolls back all writes when a transaction fails", async () => {
    await createUser(client, "user-1", "transaction@example.com");
    await createGroup(client, "group-1");

    await expect(
      client.$transaction(async (transaction) => {
        await transaction.announcement.create({
          data: {
            createdById: "user-1",
            groupId: "group-1",
            title: "Must roll back",
          },
        });
        throw new Error("Abort transaction");
      }),
    ).rejects.toThrow("Abort transaction");

    await expect(client.announcement.count()).resolves.toBe(0);
  });
});

function createGroup(client: PrismaClient, id: string) {
  return client.organization.create({
    data: { createdAt: new Date(), id, name: id, slug: id },
  });
}

function createUser(client: PrismaClient, id: string, email: string) {
  return client.user.create({
    data: { id, email, name: "Test User" },
  });
}
