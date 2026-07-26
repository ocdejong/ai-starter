import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  baselinedMigrations,
  listMigrationFiles,
  selectMigrationsToLint,
} from "./migration-lint.ts";
import { repositoryRoot } from "./repository.ts";

/**
 * The baseline is the whole design here: an applied migration is immutable, so
 * the gate can only bind the ones written after it. These tests keep that
 * honest — the list may only shrink, and everything outside it is linted.
 */

describe("selectMigrationsToLint", () => {
  it("lints a migration written after the gate landed", () => {
    const selected = selectMigrationsToLint([
      "packages/db/prisma/migrations/20260722113815_init/migration.sql",
      "packages/db/prisma/migrations/29990101000000_new_feature/migration.sql",
    ]);

    expect(selected).toEqual([
      "packages/db/prisma/migrations/29990101000000_new_feature/migration.sql",
    ]);
  });

  it("leaves every baselined migration alone", () => {
    expect(selectMigrationsToLint([...baselinedMigrations])).toEqual([]);
  });
});

describe("baselinedMigrations", () => {
  // The list is closed. A new migration belongs in the lint, not in here — and
  // an entry that no longer exists is a name nobody will ever notice is stale.
  it("names only migrations this repository still carries", () => {
    for (const file of baselinedMigrations) {
      expect(existsSync(path.join(repositoryRoot, file))).toBe(true);
    }
  });

  it("does not grow", () => {
    expect(baselinedMigrations).toHaveLength(5);
  });

  it("covers every migration that predates the gate and no more", () => {
    const all = listMigrationFiles(repositoryRoot);

    expect(all.length).toBeGreaterThanOrEqual(baselinedMigrations.length);
    for (const file of baselinedMigrations) {
      expect(all).toContain(file);
    }
  });
});

describe("listMigrationFiles", () => {
  it("finds the committed migrations in applied order", () => {
    const all = listMigrationFiles(repositoryRoot);

    expect(all[0]).toBe(
      "packages/db/prisma/migrations/20260722113815_init/migration.sql",
    );
    expect(all).toEqual([...all].sort());
  });
});
