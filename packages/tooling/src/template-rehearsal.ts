import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { runCapture, runInherit } from "./command.ts";
import {
  postgresContainerName,
  probeContainerRuntime,
} from "./container-runtime.ts";
import { parseDatabaseUrl } from "./database-url.ts";
import { parseEnvFile, setEnvValue } from "./env-file.ts";
import { featureMigrationSql } from "./generators/feature.ts";
import { featureNames } from "./generators/naming.ts";
import { webEnvPath } from "./repository.ts";
import { findFreePort } from "./tcp.ts";

/**
 * Runs the golden path the way a downstream product first meets it.
 *
 * Every other check in this repository judges the code that is committed here.
 * This one judges the code the repository *produces*: a template instantiated
 * with no history, renamed to somebody else's product, bootstrapped from
 * nothing, and then made to grow a context, a feature and an adapter before the
 * whole authoritative suite is run over the result.
 *
 * It is the only gate that compiles what `pnpm generate adapter` emits. Stage 13
 * generated that template, verified it once and removed the output, so until
 * this existed a syntax error in it failed nothing — and by the time this was
 * written the template had already drifted into emitting an assertion the lint
 * rules reject. It is also the only place the migration follow-up is executed
 * rather than read.
 */

type RehearsalStep = {
  readonly name: string;
  /** The command as a reader would type it, for the failure message. */
  readonly command: string;
};

export type RehearsalOutcome = {
  readonly checkout: string;
  readonly failed: RehearsalStep | undefined;
  readonly code: number;
};

/** The product a rehearsal pretends to be. Two words, so every name form differs. */
export const rehearsalProductName = "Rehearsal Product";

/** Names chosen so identifier forms and copy forms cannot be confused. */
export const rehearsalSlices = {
  adapter: "payment-gateway",
  context: "billing-period",
  feature: "release-note",
} as const;

function log(message: string): void {
  console.log(`rehearse: ${message}`);
}

/**
 * Copies the checkout the way a template instantiation ships it: the files git
 * tracks plus the ones it would track, and no history, no install, no `.env`.
 * Reading the working tree rather than a commit is deliberate — the point is to
 * rehearse the change in front of you, before it lands.
 */
export function instantiateTemplate(root: string, destination: string): number {
  const listed = runCapture(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root },
  );
  if (listed.code !== 0) {
    return listed.code;
  }

  const files = listed.stdout.split("\0").filter((entry) => entry.length > 0);
  for (const file of files) {
    const source = path.join(root, file);
    if (!existsSync(source)) {
      // `ls-files` lists a deletion that is staged but not committed.
      continue;
    }
    const target = path.join(destination, file);
    mkdirSync(path.dirname(target), { recursive: true });
    cpSync(source, target);
  }

  log(`instantiated ${String(files.length)} files into ${destination}`);
  return 0;
}

/**
 * Applies the SQL `pnpm generate feature` prints, to the migration Prisma just
 * wrote. The header goes above what Prisma emitted and the body below it, which
 * is what the follow-up text says — and both halves come from the same function
 * that prints it, so the instruction and the rehearsal cannot drift apart.
 */
export function finishFeatureMigration(
  checkout: string,
  feature: string,
): string {
  const directory = path.join(checkout, "packages/db/prisma/migrations");
  const written = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .at(-1);

  if (written === undefined) {
    throw new Error("Prisma wrote no migration to finish.");
  }

  const file = path.join(directory, written, "migration.sql");
  const sql = featureMigrationSql(featureNames(feature));
  writeFileSync(file, `${sql.header}${readFileSync(file, "utf8")}${sql.body}`);

  return `packages/db/prisma/migrations/${written}/migration.sql`;
}

/**
 * Moves the instantiated product's web origin to a port nothing holds.
 *
 * `pnpm bootstrap` gives a plain checkout the example's own port, which is the
 * right default for the first clone on a machine and the wrong one here: a
 * developer's dev server or a sibling worktree already answers there, and
 * Playwright reuses whatever it finds — so the browser journey would run against
 * another application and report a page that does not exist.
 */
export async function moveWebOrigin(checkout: string): Promise<number> {
  const file = path.join(checkout, webEnvPath);
  const content = readFileSync(file, "utf8");
  const configured = parseEnvFile(content).get("BETTER_AUTH_URL") ?? "";
  const url = new URL(configured);
  const port = await findFreePort(url.hostname, Number(url.port) + 1);

  url.port = String(port);
  writeFileSync(
    file,
    setEnvValue(content, "BETTER_AUTH_URL", url.toString().replace(/\/$/, "")),
  );

  return port;
}

/** Removes the database container the rehearsal's own bootstrap created. */
export function removeDatabaseContainer(checkout: string): void {
  const file = path.join(checkout, webEnvPath);
  if (!existsSync(file)) {
    return;
  }

  const databaseUrl = parseEnvFile(readFileSync(file, "utf8")).get(
    "DATABASE_URL",
  );
  const probe = probeContainerRuntime(checkout);
  if (databaseUrl === undefined || probe.runtime === undefined) {
    return;
  }

  const connection = parseDatabaseUrl(databaseUrl);
  const name = postgresContainerName(connection.database, connection.port);
  runCapture(probe.runtime, ["rm", "--force", name], { cwd: checkout });
  log(`removed container "${name}"`);
}

/**
 * The whole rehearsal, in order. Stops at the first failure so the cause stays
 * visible, and names the command a reader would run to reproduce it.
 */
export async function runRehearsal(
  root: string,
  checkout: string,
): Promise<RehearsalOutcome> {
  const fail = (step: RehearsalStep, code: number): RehearsalOutcome => ({
    checkout,
    code,
    failed: step,
  });

  const instantiated = instantiateTemplate(root, checkout);
  if (instantiated !== 0) {
    return fail(
      { command: "git ls-files", name: "instantiate the template" },
      instantiated,
    );
  }

  const scripted: readonly (RehearsalStep & { args: readonly string[] })[] = [
    {
      args: ["starter:init", "--name", rehearsalProductName],
      command: `pnpm starter:init --name "${rehearsalProductName}"`,
      name: "rename the starter to a product",
    },
    { args: ["bootstrap"], command: "pnpm bootstrap", name: "bootstrap" },
    {
      args: ["generate", "context", rehearsalSlices.context],
      command: `pnpm generate context ${rehearsalSlices.context}`,
      name: "generate a bounded context",
    },
    {
      args: ["generate", "feature", rehearsalSlices.feature],
      command: `pnpm generate feature ${rehearsalSlices.feature}`,
      name: "generate a vertical slice",
    },
    {
      args: ["generate", "adapter", rehearsalSlices.adapter],
      command: `pnpm generate adapter ${rehearsalSlices.adapter}`,
      name: "generate an adapter behind a port",
    },
  ];

  for (const step of scripted) {
    log(step.name);
    const code = runInherit("pnpm", step.args, { cwd: checkout });
    if (code !== 0) {
      return fail(step, code);
    }
    if (step.name === "bootstrap") {
      log(
        `the browser journey will run on port ${String(await moveWebOrigin(checkout))}`,
      );
    }
  }

  const migrationName = `add_${featureNames(rehearsalSlices.feature).camelPlural}`;
  const createMigration: RehearsalStep = {
    command: `pnpm db:migrate:dev --name ${migrationName} --create-only`,
    name: "write the feature's migration",
  };
  log(createMigration.name);
  const created = runInherit(
    "pnpm",
    ["db:migrate:dev", "--name", migrationName, "--create-only"],
    { cwd: checkout },
  );
  if (created !== 0) {
    return fail(createMigration, created);
  }

  log(`finished ${finishFeatureMigration(checkout, rehearsalSlices.feature)}`);

  const applyMigration: RehearsalStep = {
    command: "pnpm db:migrate:dev",
    name: "apply the feature's migration",
  };
  log(applyMigration.name);
  const applied = runInherit("pnpm", ["db:migrate:dev"], { cwd: checkout });
  if (applied !== 0) {
    return fail(applyMigration, applied);
  }

  const verify: RehearsalStep = { command: "pnpm verify", name: "verify" };
  log("verify — the authoritative suite, over generated code");
  const verified = runInherit("pnpm", ["verify"], { cwd: checkout });
  if (verified !== 0) {
    return fail(verify, verified);
  }

  return { checkout, code: 0, failed: undefined };
}

export function discardCheckout(checkout: string): void {
  rmSync(checkout, { force: true, recursive: true });
}
