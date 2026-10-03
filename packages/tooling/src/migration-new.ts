import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { runCapture, type CommandResult } from "./command.ts";
import { parseDatabaseUrl } from "./database-url.ts";

export class MigrationError extends Error {}

/**
 * Runs the Prisma CLI from `packages/db`, where `prisma.config.ts` lives, with
 * extra environment for that one invocation. Injected so a test can answer for
 * Prisma instead of starting a database.
 */
export type PrismaRunner = (
  args: readonly string[],
  env: Readonly<Record<string, string>>,
) => CommandResult;

export type NewMigrationOptions = {
  readonly root: string;
  readonly name: string;
  /** Any PostgreSQL the caller may create and drop a scratch database on. */
  readonly databaseUrl: string;
  readonly now: Date;
  readonly prisma?: PrismaRunner;
  /** Distinguishes the scratch database from any other left by a crashed run. */
  readonly scratchSuffix?: string;
  /** Overridable so a test can diff a schema and migration set of its own. */
  readonly schemaPath?: string;
  readonly migrationsDirectory?: string;
};

export type NewMigration = {
  readonly directory: string;
  readonly file: string;
};

const nameFormat = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;

export function validateMigrationName(name: string): void {
  if (!nameFormat.test(name)) {
    throw new MigrationError(
      `"${name}" is not a usable migration name. Use lowercase words joined by underscores, for example add_invoice_due_date.`,
    );
  }
}

/** Prisma names a migration folder with the UTC time it was created, to the second. */
export function migrationFolderName(name: string, now: Date): string {
  const stamp = now
    .toISOString()
    .replace(/\.\d{3}Z$/, "")
    .replace(/[-:T]/g, "");
  return `${stamp}_${name}`;
}

/**
 * Prisma applies each migration inside a transaction, so both timeouts are
 * transaction-local; without them a schema change waits behind whatever already
 * holds the table, and `pnpm db:lint` rejects the file for lacking them.
 */
const timeoutHeader = `-- Prisma applies each migration inside a transaction, so both timeouts are
-- transaction-local. Without them a schema change waits behind whatever is
-- already holding the table, for as long as that takes.
set lock_timeout = '1s';
set statement_timeout = '5s';
`;

export function withTimeouts(diff: string): string {
  return `${timeoutHeader}\n${diff.trimEnd()}\n`;
}

function defaultPrisma(root: string): PrismaRunner {
  return (args, env) =>
    runCapture("pnpm", ["exec", "prisma", ...args], {
      cwd: path.join(root, "packages/db"),
      env,
    });
}

/**
 * Writes a new migration folder from the difference between what the committed
 * migrations build and what `schema.prisma` now says.
 *
 * `prisma migrate dev` is the usual route and cannot run without a terminal, so
 * this does the part of it that matters: replay the migrations into a scratch
 * database created beside the target, diff that against the schema, and drop
 * the scratch database again whatever happened. Nothing is applied to the
 * target; `pnpm db:migrate` does that.
 */
export function createMigration(options: NewMigrationOptions): NewMigration {
  validateMigrationName(options.name);

  const root = options.root;
  const migrations = path.resolve(
    root,
    options.migrationsDirectory ?? "packages/db/prisma/migrations",
  );
  const schema = path.resolve(
    root,
    options.schemaPath ?? "packages/db/prisma/schema.prisma",
  );
  const folder = migrationFolderName(options.name, options.now);
  const directory = path.join(migrations, folder);

  const existing = existsSync(migrations)
    ? readdirSync(migrations, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
    : [];
  const latest = existing.at(-1);
  if (latest !== undefined && latest >= folder) {
    throw new MigrationError(
      `The newest migration, ${latest}, does not sort before ${folder}. Prisma applies migrations in name order, so a new one must be newer than every existing one.`,
    );
  }

  const prisma = options.prisma ?? defaultPrisma(root);
  const diff = diffAgainstScratchDatabase(
    prisma,
    options.databaseUrl,
    options.scratchSuffix ?? randomUUID().slice(0, 8),
    migrations,
    schema,
  );

  mkdirSync(directory, { recursive: true });
  const file = path.join(directory, "migration.sql");
  writeFileSync(file, withTimeouts(diff));
  return { directory, file };
}

function diffAgainstScratchDatabase(
  prisma: PrismaRunner,
  databaseUrl: string,
  suffix: string,
  migrations: string,
  schema: string,
): string {
  const connection = parseDatabaseUrl(databaseUrl);
  // PostgreSQL truncates identifiers at 63 bytes, and a truncated name could
  // collide with the database it was derived from.
  const scratchName = `${connection.database.slice(0, 40)}_shadow_${suffix}`;
  if (scratchName.includes('"')) {
    throw new MigrationError(
      "The database name contains a quote, so a scratch database cannot be named after it.",
    );
  }

  const scratchUrl = new URL(databaseUrl);
  scratchUrl.pathname = `/${encodeURIComponent(scratchName)}`;

  const workDirectory = mkdtempSync(path.join(tmpdir(), "migration-new-"));
  const execute = (statement: string): CommandResult => {
    const script = path.join(workDirectory, "statement.sql");
    writeFileSync(script, `${statement}\n`);
    return prisma(["db", "execute", "--file", script], {});
  };

  try {
    const created = execute(`CREATE DATABASE "${scratchName}";`);
    if (created.code !== 0) {
      throw new MigrationError(
        `Could not create a scratch database to replay the migrations in. The role in DATABASE_URL needs CREATEDB.\n${created.stderr.trim()}`,
      );
    }

    try {
      const result = prisma(
        [
          "migrate",
          "diff",
          "--from-migrations",
          migrations,
          "--to-schema",
          schema,
          "--script",
          "--exit-code",
        ],
        { SHADOW_DATABASE_URL: scratchUrl.toString() },
      );

      // `--exit-code` makes 0 mean "nothing to migrate" and 2 mean "a diff".
      if (result.code === 0) {
        throw new MigrationError(
          "The schema matches the committed migrations, so there is nothing to migrate. Edit packages/db/prisma/schema.prisma first.",
        );
      }
      if (result.code !== 2) {
        throw new MigrationError(
          `prisma migrate diff failed with exit code ${String(result.code)}.\n${(result.stderr || result.stdout).trim()}`,
        );
      }
      return result.stdout;
    } finally {
      const dropped = execute(
        `DROP DATABASE IF EXISTS "${scratchName}" WITH (FORCE);`,
      );
      if (dropped.code !== 0) {
        process.stderr.write(
          `db:migration:new: could not drop the scratch database "${scratchName}"; drop it by hand.\n`,
        );
      }
    }
  } finally {
    rmSync(workDirectory, { force: true, recursive: true });
  }
}
