import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { PostgreSqlContainer } from "@testcontainers/postgresql";
import type { TestProject } from "vitest/node";

const execFileAsync = promisify(execFile);

const databasePackage = fileURLToPath(new URL("../../db", import.meta.url));
const schemaPath = fileURLToPath(
  new URL("../../db/prisma/schema.prisma", import.meta.url),
);

/** The package's one PostgreSQL, migrated once and provided to every file. */
export default async function setup(project: TestProject) {
  const container = await new PostgreSqlContainer("postgres:17-alpine").start();
  const databaseUrl = container.getConnectionUri();
  try {
    await execFileAsync(
      "pnpm",
      ["exec", "prisma", "migrate", "deploy", "--schema", schemaPath],
      {
        cwd: databasePackage,
        env: { ...process.env, DATABASE_URL: databaseUrl },
      },
    );
    project.provide("databaseUrl", databaseUrl);
  } catch (error) {
    await container.stop();
    throw error;
  }
  return async () => {
    await container.stop();
  };
}
