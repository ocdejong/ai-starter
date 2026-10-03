import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { CommandResult } from "./command.ts";
import {
  createMigration,
  migrationFolderName,
  MigrationError,
  validateMigrationName,
  withTimeouts,
  type PrismaRunner,
} from "./migration-new.ts";

const fixtures: string[] = [];

afterEach(() => {
  for (const directory of fixtures.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

const now = new Date("2026-10-04T08:09:07.123Z");
const databaseUrl = "postgresql://postgres:secret@localhost:5540/ai-starter";
const ok: CommandResult = { code: 0, stderr: "", stdout: "" };

function repository(existing: readonly string[] = []): string {
  const root = mkdtempSync(path.join(tmpdir(), "migration-new-test-"));
  fixtures.push(root);
  const migrations = path.join(root, "packages/db/prisma/migrations");
  mkdirSync(migrations, { recursive: true });
  writeFileSync(path.join(migrations, "migration_lock.toml"), "x\n");
  for (const name of existing) {
    mkdirSync(path.join(migrations, name));
  }
  return root;
}

type Call = { args: readonly string[]; env: Readonly<Record<string, string>> };

/** Answers for Prisma and records what it was asked, including each SQL script it ran. */
function fakePrisma(diff: CommandResult): {
  calls: Call[];
  scripts: string[];
  prisma: PrismaRunner;
} {
  const calls: Call[] = [];
  const scripts: string[] = [];
  const prisma: PrismaRunner = (args, env) => {
    calls.push({ args, env });
    if (args[0] === "db") {
      const file = args[args.indexOf("--file") + 1];
      scripts.push(readFileSync(file ?? "", "utf8").trim());
      return ok;
    }
    return diff;
  };
  return { calls, prisma, scripts };
}

const changed: CommandResult = {
  code: 2,
  stderr: "Loaded Prisma config from prisma.config.ts.\n",
  stdout: '-- CreateTable\nCREATE TABLE "Invoice" ("id" TEXT NOT NULL);\n',
};

describe("migration names", () => {
  it.each(["add_invoice_due_date", "init", "v2_index"])(
    "accepts %s",
    (name) => {
      expect(() => {
        validateMigrationName(name);
      }).not.toThrow();
    },
  );

  it.each([
    "",
    "Add_Invoice",
    "add-invoice",
    "add invoice",
    "_x",
    "x_",
    "a__b",
    "../x",
  ])("rejects %j", (name) => {
    expect(() => {
      validateMigrationName(name);
    }).toThrow(MigrationError);
  });

  it("names the folder with Prisma's UTC timestamp to the second", () => {
    expect(migrationFolderName("add_invoice", now)).toBe(
      "20261004080907_add_invoice",
    );
  });
});

describe("withTimeouts", () => {
  // `pnpm db:lint` rejects a migration that does not set both before it changes
  // anything, so the header must come first.
  it("puts both timeouts before the statements Prisma wrote", () => {
    const sql = withTimeouts('-- CreateTable\nCREATE TABLE "a" ();\n\n');

    expect(sql.indexOf("set lock_timeout")).toBeGreaterThan(-1);
    expect(sql.indexOf("set statement_timeout")).toBeGreaterThan(-1);
    expect(sql.indexOf("set statement_timeout")).toBeLessThan(
      sql.indexOf("CREATE TABLE"),
    );
    expect(sql.endsWith('CREATE TABLE "a" ();\n')).toBe(true);
  });
});

describe("createMigration", () => {
  it("writes the diff under a timestamped folder, timeouts first", () => {
    const root = repository([
      "20260728085500_organization_name_check_validate",
    ]);
    const { prisma } = fakePrisma(changed);

    const created = createMigration({
      databaseUrl,
      name: "add_invoice",
      now,
      prisma,
      root,
      scratchSuffix: "abc123",
    });

    expect(created.file).toBe(
      path.join(
        root,
        "packages/db/prisma/migrations/20261004080907_add_invoice/migration.sql",
      ),
    );
    const sql = readFileSync(created.file, "utf8");
    expect(sql).toContain("set lock_timeout = '1s';");
    expect(sql).toContain("set statement_timeout = '5s';");
    expect(sql).toContain('CREATE TABLE "Invoice"');
    expect(sql.indexOf("set lock_timeout")).toBeLessThan(
      sql.indexOf("CREATE TABLE"),
    );
    // The stderr banner Prisma prints is not part of the migration.
    expect(sql).not.toContain("Loaded Prisma config");
  });

  it("replays the migrations in a scratch database beside the target, then drops it", () => {
    const root = repository();
    const { calls, prisma, scripts } = fakePrisma(changed);

    createMigration({
      databaseUrl,
      name: "add_invoice",
      now,
      prisma,
      root,
      scratchSuffix: "abc123",
    });

    expect(scripts).toEqual([
      'CREATE DATABASE "ai-starter_shadow_abc123";',
      'DROP DATABASE IF EXISTS "ai-starter_shadow_abc123" WITH (FORCE);',
    ]);
    const diff = calls.find((call) => call.args[0] === "migrate");
    expect(diff?.args).toEqual([
      "migrate",
      "diff",
      "--from-migrations",
      path.join(root, "packages/db/prisma/migrations"),
      "--to-schema",
      path.join(root, "packages/db/prisma/schema.prisma"),
      "--script",
      "--exit-code",
    ]);
    expect(diff?.env.SHADOW_DATABASE_URL).toBe(
      "postgresql://postgres:secret@localhost:5540/ai-starter_shadow_abc123",
    );
  });

  it("refuses to write an empty migration and still drops the scratch database", () => {
    const root = repository();
    const { prisma, scripts } = fakePrisma({
      code: 0,
      stderr: "",
      stdout: "-- This is an empty migration.\n",
    });

    expect(() =>
      createMigration({ databaseUrl, name: "noop", now, prisma, root }),
    ).toThrow(/nothing to migrate/);

    expect(scripts.at(-1)).toMatch(/^DROP DATABASE IF EXISTS/);
    expect(
      readdirSync(path.join(root, "packages/db/prisma/migrations")),
    ).toEqual(["migration_lock.toml"]);
  });

  it("reports what Prisma said when the diff fails, and writes nothing", () => {
    const root = repository();
    const { prisma, scripts } = fakePrisma({
      code: 1,
      stderr: "Error: schema is invalid",
      stdout: "",
    });

    expect(() =>
      createMigration({ databaseUrl, name: "broken", now, prisma, root }),
    ).toThrow(/schema is invalid/);

    expect(scripts.at(-1)).toMatch(/^DROP DATABASE IF EXISTS/);
    expect(
      existsSync(
        path.join(root, "packages/db/prisma/migrations/20261004080907_broken"),
      ),
    ).toBe(false);
  });

  it("explains a missing CREATEDB privilege instead of failing on the diff", () => {
    const root = repository();
    const prisma: PrismaRunner = () => ({
      code: 1,
      stderr: "permission denied to create database",
      stdout: "",
    });

    expect(() =>
      createMigration({ databaseUrl, name: "x", now, prisma, root }),
    ).toThrow(/CREATEDB/);
  });

  // Prisma applies migrations in name order, so a clock behind the newest
  // migration would write one that is applied before the schema it builds on.
  it("refuses a name that would sort before an existing migration", () => {
    const root = repository(["20270101000000_from_the_future"]);
    const { prisma, calls } = fakePrisma(changed);

    expect(() =>
      createMigration({ databaseUrl, name: "late", now, prisma, root }),
    ).toThrow(/does not sort before/);
    expect(calls).toEqual([]);
  });

  it("rejects an invalid name before touching any database", () => {
    const root = repository();
    const { prisma, calls } = fakePrisma(changed);

    expect(() =>
      createMigration({ databaseUrl, name: "Bad Name", now, prisma, root }),
    ).toThrow(MigrationError);
    expect(calls).toEqual([]);
  });
});
