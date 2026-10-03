import { relative } from "node:path";

import { checkLocalDatabase } from "../local-database.ts";
import { createMigration, MigrationError } from "../migration-new.ts";
import { repositoryRoot } from "../repository.ts";

const usage = `Usage: pnpm db:migration:new <name>

Writes a new Prisma migration from the difference between the committed
migrations and packages/db/prisma/schema.prisma, with the lock and statement
timeouts \`pnpm db:lint\` requires already at the top. It replaces
\`prisma migrate dev --create-only\`, which refuses to run without a terminal.

<name> is lowercase words joined by underscores, for example
add_invoice_due_date. The diff is computed in a scratch database created beside
the one DATABASE_URL names and dropped again, so DATABASE_URL must point at a
local database. Nothing is applied: review the file, run \`pnpm db:lint\`, then
\`pnpm db:migrate\`.`;

const argumentsGiven = process.argv.slice(2);

if (argumentsGiven.includes("--help")) {
  console.log(usage);
} else if (argumentsGiven.length !== 1 || argumentsGiven[0]?.startsWith("-")) {
  console.error(`Expected exactly one migration name.\n\n${usage}`);
  process.exitCode = 2;
} else {
  process.exitCode = main(argumentsGiven[0] ?? "");
}

function main(name: string): number {
  const databaseUrl = process.env.DATABASE_URL;
  const verdict = checkLocalDatabase(databaseUrl);
  if (databaseUrl === undefined || !verdict.local) {
    const reason = verdict.local ? "DATABASE_URL is not set." : verdict.reason;
    console.error(
      `db:migration:new refused: ${reason}\n` +
        `It creates and drops a scratch database, which is only safe on your own machine.\n` +
        `fix: point DATABASE_URL at a local database.`,
    );
    return 1;
  }

  try {
    const created = createMigration({
      databaseUrl,
      name,
      now: new Date(),
      root: repositoryRoot,
    });
    console.log(
      `db:migration:new: wrote ${relative(repositoryRoot, created.file)}\n` +
        "Review it, run `pnpm db:lint`, then apply it with `pnpm db:migrate`.",
    );
    return 0;
  } catch (error) {
    if (error instanceof MigrationError) {
      console.error(`db:migration:new: ${error.message}`);
      return 1;
    }
    throw error;
  }
}
