import { runInherit } from "../command.ts";
import {
  baselinedMigrations,
  listMigrationFiles,
  selectMigrationsToLint,
} from "../migration-lint.ts";
import { repositoryRoot } from "../repository.ts";

const usage = `Usage: pnpm db:lint

Runs Squawk over the committed migrations, reporting statements that would lock
a busy table, break a running client, or leave a half-applied migration behind.
Rules live in .squawk.toml; which files are read lives in
packages/tooling/src/migration-lint.ts, where the migrations that predate this
gate are baselined because an applied migration can no longer be edited.`;

if (process.argv.includes("--help")) {
  console.log(usage);
} else {
  const files = selectMigrationsToLint(listMigrationFiles(repositoryRoot));

  if (files.length === 0) {
    console.log(
      `db:lint: no migrations to lint (${String(baselinedMigrations.length)} baselined as already applied).`,
    );
  } else {
    console.log(`db:lint: checking ${String(files.length)} migration(s).`);
    process.exitCode = runInherit("pnpm", ["exec", "squawk", ...files], {
      cwd: repositoryRoot,
    });
  }
}
