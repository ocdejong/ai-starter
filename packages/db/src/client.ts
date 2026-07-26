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

/**
 * The development-reload cache. Widening the global to an intersection says the
 * true thing — this global *may also* carry a client — where the usual
 * `globalThis as unknown as {…}` claims it is some other object entirely.
 */
type GlobalWithPrisma = typeof globalThis & {
  prisma?: ReturnType<typeof createPrismaClient>;
};

const globalForPrisma = globalThis as GlobalWithPrisma;

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
