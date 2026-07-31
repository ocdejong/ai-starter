import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "../generated/prisma";
import { createDatabaseClient } from "./client";

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

    client = createDatabaseClient(databaseUrl);
  }, 120_000);

  afterEach(async () => {
    await client.member.deleteMany();
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
