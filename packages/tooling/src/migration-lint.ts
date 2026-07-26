import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * Which migration files `pnpm db:lint` hands to Squawk.
 *
 * Every migration written from here on is linted. The five below are not,
 * because an applied migration is immutable: Prisma stores its checksum and
 * refuses to re-apply a file that changed, so a finding in one of them cannot be
 * fixed without breaking every checkout that has already run it. The list is
 * closed — `migration-lint.test.ts` fails if it grows, and a new migration
 * belongs in the lint rather than in here.
 */
export const baselinedMigrations: readonly string[] = [
  "packages/db/prisma/migrations/20260722113815_init/migration.sql",
  "packages/db/prisma/migrations/20260724174902_auth_flow_indexes/migration.sql",
  "packages/db/prisma/migrations/20260725101009_groups/migration.sql",
  "packages/db/prisma/migrations/20260726073257_announcement_example/migration.sql",
  "packages/db/prisma/migrations/20260726074832_remove_post_example/migration.sql",
];

const migrationsDirectory = "packages/db/prisma/migrations";

/** Every committed migration, in the order Prisma applies them. */
export function listMigrationFiles(root: string): string[] {
  const directory = path.join(root, migrationsDirectory);
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${migrationsDirectory}/${entry.name}/migration.sql`)
    .filter((file) => existsSync(path.join(root, file)))
    .sort();
}

export function selectMigrationsToLint(files: readonly string[]): string[] {
  const baseline = new Set(baselinedMigrations);
  return files.filter((file) => !baseline.has(file));
}
