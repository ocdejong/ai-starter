import "server-only";

import { PrismaClient } from "../generated/prisma";

/**
 * The persistence client type, exposed so consumers that receive the database
 * by injection (the Better Auth factory in `@ai-starter/auth`) can name it
 * without importing the generated client directly.
 */
export type Database = PrismaClient;

/**
 * Builds a client bound to an explicit connection string. The default `db`
 * singleton reads `DATABASE_URL` at import time, which is too early for an
 * integration test whose PostgreSQL port is assigned after the container
 * starts; this factory lets such callers point a client at that container.
 */
export const createDatabaseClient = (datasourceUrl: string): Database =>
  new PrismaClient({ datasourceUrl });

const createPrismaClient = () =>
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
