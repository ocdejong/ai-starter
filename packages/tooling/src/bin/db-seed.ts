import { runInherit } from "../command.ts";
import { checkLocalDatabase } from "../local-database.ts";
import { repositoryRoot } from "../repository.ts";

const usage = `Usage: pnpm db:seed

Seeds the development database with the demo account documented in README.md,
so a bootstrapped checkout can be signed into immediately. The demo password is
public documentation, so this refuses to run unless DATABASE_URL points at a
local database. Safe to run repeatedly: an existing demo account is left alone.`;

if (process.argv.includes("--help")) {
  console.log(usage);
} else {
  const verdict = checkLocalDatabase(process.env.DATABASE_URL);

  if (!verdict.local) {
    console.error(
      `db:seed refused: ${verdict.reason}\n` +
        `The demo account's credentials are public documentation, so they may only exist in a database on your own machine.\n` +
        `fix: point DATABASE_URL at a local database.`,
    );
    process.exitCode = 1;
  } else {
    process.exitCode = runInherit(
      "pnpm",
      ["--filter", "@ai-starter/auth", "db:seed"],
      { cwd: repositoryRoot },
    );
  }
}
