import { runInherit } from "../command.ts";
import { checkLocalDatabase } from "../local-database.ts";
import { repositoryRoot } from "../repository.ts";

const usage = `Usage: pnpm db:push:prototype

Pushes the Prisma schema straight to the database, with no migration. This is a
disposable prototyping escape hatch, so it refuses to run unless DATABASE_URL
points at a local database. Use a migration (\`pnpm db:migrate:dev\`) for any
shared or deployed database.`;

if (process.argv.includes("--help")) {
  console.log(usage);
} else {
  const verdict = checkLocalDatabase(process.env.DATABASE_URL);

  if (!verdict.local) {
    console.error(
      `db:push:prototype refused: ${verdict.reason}\n` +
        `\`prisma db push\` rewrites the schema with no migration and no review, so it is only safe against your own machine.\n` +
        `fix: point DATABASE_URL at a local database, or use \`pnpm db:migrate:dev\` to change a shared one through a migration.`,
    );
    process.exitCode = 1;
  } else {
    process.exitCode = runInherit(
      "pnpm",
      ["--filter", "@ai-starter/db", "db:push:prototype"],
      { cwd: repositoryRoot },
    );
  }
}
