import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma";

/**
 * The persistence client type, exposed so consumers that receive the database
 * by injection (the Better Auth factory in `@ai-starter/auth`) can name it
 * without importing the generated client directly.
 */
export type Database = PrismaClient;

/**
 * Prisma 7 connects through a driver adapter and refuses to construct without
 * one — `datasourceUrl`, which every caller here used to pass, is now rejected
 * outright as "not compatible with Prisma Driver Adapters". So the connection
 * string stops being something the schema reads from the environment and
 * becomes an argument this module hands to `pg`, which is why both
 * constructors below now name it explicitly.
 */
const createAdapter = (connectionString: string) =>
  new PrismaPg({ connectionString });

/**
 * Builds a client bound to an explicit connection string. The default `db`
 * singleton reads `DATABASE_URL` at import time, which is too early for an
 * integration test whose PostgreSQL port is assigned after the container
 * starts; this factory lets such callers point a client at that container.
 */
export const createDatabaseClient = (datasourceUrl: string): Database =>
  new PrismaClient({ adapter: createAdapter(datasourceUrl) });

/**
 * The singleton's connection string. Prisma used to read `DATABASE_URL` itself,
 * through `env()` in the schema, and fail at connect time when it was missing.
 * The adapter takes a string, so the absence has to be caught here — and this
 * says which variable and which command fixes it, where `pg` would otherwise
 * report a connection to `undefined`.
 */
const requireDatabaseUrl = (): string => {
  const url = process.env.DATABASE_URL;
  if (url === undefined || url === "") {
    throw new Error(
      "DATABASE_URL is not set, so @ai-starter/db cannot open a connection. Run `pnpm bootstrap`, or `pnpm diagnose` to see what is missing.",
    );
  }
  return url;
};

const createPrismaClient = () =>
  new PrismaClient({
    adapter: createAdapter(requireDatabaseUrl()),
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

/**
 * The process-wide client, built on first call rather than on import.
 *
 * This used to be an exported `db` constant, and under Prisma 6 that was free:
 * the connection string was the *schema's* problem, read from
 * `env("DATABASE_URL")` at connect time, so importing this module needed no
 * database. The adapter takes a string, which moves that read to construction
 * — and an eager constant would then tax every importer of this module with a
 * requirement only its users have.
 *
 * That is not hypothetical. The integration tests here and in
 * `@ai-starter/auth` import the factory beside it and take their URL from a
 * container that has not started yet; against an eager constant they failed at
 * import, before a single test ran. A function keeps "needs a database"
 * attached to using one, and it is why the composition root now asks for the
 * client instead of receiving it as a side effect of an import.
 */
export const getDatabase = (): Database => {
  const client = globalForPrisma.prisma ?? createPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  return client;
};
