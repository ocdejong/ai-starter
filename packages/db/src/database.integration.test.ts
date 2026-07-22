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
    await client.post.deleteMany();
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
    await expect(
      client.post.create({
        data: { name: "Orphan", createdById: "missing-user" },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("enforces SQL check constraints independently of Zod", async () => {
    await createUser(client, "user-1", "check@example.com");

    await expect(
      client.post.create({
        data: { name: "   ", createdById: "user-1" },
      }),
    ).rejects.toThrow();
  });

  it("rolls back all writes when a transaction fails", async () => {
    await createUser(client, "user-1", "transaction@example.com");

    await expect(
      client.$transaction(async (transaction) => {
        await transaction.post.create({
          data: { name: "Must roll back", createdById: "user-1" },
        });
        throw new Error("Abort transaction");
      }),
    ).rejects.toThrow("Abort transaction");

    await expect(client.post.count()).resolves.toBe(0);
  });
});

function createUser(client: PrismaClient, id: string, email: string) {
  return client.user.create({
    data: { id, email, name: "Test User" },
  });
}
