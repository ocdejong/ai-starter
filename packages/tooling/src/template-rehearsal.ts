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
import { featureNames } from "./generators/naming.ts";
import { featureMigrationSql, type FeatureShape } from "./generators/shape.ts";
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

/**
 * The shape the rehearsal generates, and it is deliberately not the committed
 * one.
 *
 * `golden-path.test.ts` pins the `current` shape to the `announcement` slice, so
 * every `pnpm verify` already compiles and runs those templates. Nothing does
 * that for the other shape's overlay — the debt stage 13 recorded for the
 * adapter template, at larger size. Generating `list` here is what pays it: the
 * rehearsal is the only check that compiles either overlay, and it should spend
 * that on the half nothing else covers.
 */
export const rehearsalFeatureShape = "list";

function log(message: string): void {
  console.log(`rehearse: ${message}`);
}

/**
 * Copies the checkout the way a template instantiation ships it: the files git
 * tracks plus the ones it would track, and no history, no install, no `.env`.
 * Reading the working tree rather than a commit is deliberate — the point is to
 * rehearse the change in front of you, before it lands.
 */
export function instantiateTemplate(root: string, destination: string): void {
  const listed = runCapture(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root },
  );
  if (listed.code !== 0) {
    throw new Error(
      `${root} is not a git checkout, so nothing can say which files a template instantiation would ship. Run this from a clone.`,
    );
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
  shape: FeatureShape,
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
  const sql = featureMigrationSql(featureNames(feature), shape);
  writeFileSync(file, `${sql.header}${readFileSync(file, "utf8")}${sql.body}`);

  return `packages/db/prisma/migrations/${written}/migration.sql`;
}

/**
 * The Dutch the rehearsal's generated slice ships, written by hand.
 *
 * `pnpm generate feature` writes English into both catalogs and says so, because
 * a generator cannot translate a product's own noun. `pnpm policy` now fails
 * until somebody does, which is the honest shape — and it means the rehearsal,
 * whose whole job is to end on a green `pnpm verify`, has to do the translating
 * the same way it does the migration: by executing the follow-up rather than
 * reading it.
 *
 * It can, because the rehearsal's noun is fixed. This is real Dutch for
 * `release-note` in the `list` shape and nothing else, which is why
 * {@link finishDutchCopy} takes neither a feature nor a shape: a map like this
 * cannot be written for a name it has not seen, and the keys belong to the shape
 * {@link rehearsalFeatureShape} names.
 */
const rehearsalDutchCopy: Readonly<Record<string, string>> = {
  "app.nav.releaseNotes": "Releasenotities",
  "app.releaseNotes.count":
    "{count, plural, =0 {Nog geen releasenotities} one {# releasenotitie} other {# releasenotities}}",
  "app.releaseNotes.create.description":
    "Elke releasenotitie die je toevoegt blijft in de lijst staan.",
  "app.releaseNotes.create.label": "Nieuwe titel",
  "app.releaseNotes.create.submit": "Toevoegen",
  "app.releaseNotes.create.submitting": "Toevoegen…",
  "app.releaseNotes.create.title": "Nieuwe releasenotitie",
  "app.releaseNotes.description":
    "Releasenotities horen bij de groep waarin je werkt. Wissel je van groep, dan zie je een andere set.",
  "app.releaseNotes.errors.network":
    "De server is niet bereikbaar. Controleer je verbinding en probeer het opnieuw.",
  "app.releaseNotes.errors.unexpected":
    "Er ging iets mis. Probeer het opnieuw.",
  "app.releaseNotes.list.empty": "Deze groep heeft nog niets toegevoegd.",
  "app.releaseNotes.list.title": "Alle releasenotities",
  "app.releaseNotes.loading": "Releasenotities laden…",
  "app.releaseNotes.rename.label": "Titel",
  "app.releaseNotes.rename.saved": "Opgeslagen.",
  "app.releaseNotes.rename.submit": "Opslaan",
  "app.releaseNotes.rename.submitting": "Opslaan…",
  "app.releaseNotes.title": "Releasenotities",
  "app.releaseNotes.validation.releaseNoteTitleRequired": "Vul een titel in.",
  "app.releaseNotes.validation.releaseNoteTitleTooLong":
    "Gebruik {max} tekens of minder.",
};

const dutchCatalogPath = "packages/i18n/messages/nl.json";

/**
 * Translates the slice `pnpm generate feature` just wrote into the Dutch
 * catalog, and refuses to guess.
 *
 * The keys it writes must be exactly the keys the generator emitted — no more,
 * no fewer. A slice that grows a message, loses one, or renames a namespace
 * fails here by name, rather than leaving a value in English for `pnpm policy`
 * to report from inside a rehearsal nobody is watching.
 */
export function finishDutchCopy(checkout: string): string {
  const names = featureNames(rehearsalSlices.feature);
  const file = path.join(checkout, dutchCatalogPath);
  const catalog = JSON.parse(readFileSync(file, "utf8")) as Record<
    string,
    unknown
  >;

  const generated = new Set([
    `app.nav.${names.camelPlural}`,
    ...leafPaths(read(catalog, ["app", names.camelPlural]) ?? {}).map(
      (leaf) => `app.${names.camelPlural}.${leaf}`,
    ),
  ]);
  const written = new Set(Object.keys(rehearsalDutchCopy));

  const missing = [...generated].filter((key) => !written.has(key)).sort();
  const unknown = [...written].filter((key) => !generated.has(key)).sort();
  if (missing.length > 0 || unknown.length > 0) {
    throw new Error(
      `The Dutch copy in template-rehearsal.ts no longer matches what \`pnpm generate feature ${rehearsalSlices.feature}\` writes.${
        missing.length > 0 ? `\n  untranslated: ${missing.join(", ")}` : ""
      }${unknown.length > 0 ? `\n  no longer generated: ${unknown.join(", ")}` : ""}`,
    );
  }

  for (const [key, dutch] of Object.entries(rehearsalDutchCopy)) {
    write(catalog, key.split("."), dutch);
  }
  writeFileSync(file, `${JSON.stringify(catalog, null, 2)}\n`);

  return dutchCatalogPath;
}

/** Every leaf path inside a catalog namespace, dotted and relative to it. */
function leafPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) {
    return prefix === "" ? [] : [prefix];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, nested]) =>
      leafPaths(nested, prefix === "" ? key : `${prefix}.${key}`),
  );
}

function read(catalog: Record<string, unknown>, keys: string[]): unknown {
  return keys.reduce<unknown>(
    (value, key) =>
      typeof value === "object" && value !== null
        ? (value as Record<string, unknown>)[key]
        : undefined,
    catalog,
  );
}

function write(
  catalog: Record<string, unknown>,
  keys: string[],
  value: string,
): void {
  const [head, ...rest] = keys;
  if (head === undefined) {
    return;
  }
  if (rest.length === 0) {
    catalog[head] = value;
    return;
  }

  const nested = catalog[head];
  if (typeof nested !== "object" || nested === null) {
    throw new Error(`The Dutch catalog has no "${head}" object to extend.`);
  }
  write(nested as Record<string, unknown>, rest, value);
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

  try {
    instantiateTemplate(root, checkout);
  } catch (error) {
    console.error(
      `rehearse: ${error instanceof Error ? error.message : String(error)}`,
    );
    return fail(
      { command: "git ls-files", name: "instantiate the template" },
      1,
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
      args: [
        "generate",
        "feature",
        rehearsalSlices.feature,
        "--shape",
        rehearsalFeatureShape,
      ],
      command: `pnpm generate feature ${rehearsalSlices.feature} --shape ${rehearsalFeatureShape}`,
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
    if (step.name === "generate a vertical slice") {
      log(`translated ${finishDutchCopy(checkout)}`);
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

  log(
    `finished ${finishFeatureMigration(checkout, rehearsalSlices.feature, rehearsalFeatureShape)}`,
  );

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

  /*
   * The golden path travelled backwards.
   *
   * A product that adopts this template has to be able to change its mind, and
   * the only honest proof of that is a suite that is green *after* the slice is
   * gone — not a removal command whose output somebody read. The slice removed
   * here is the one this run generated: the committed example is pinned as
   * generator output, and taking it out is a different case, covered by
   * `feature-generator.test.ts` where it costs seconds rather than a suite.
   *
   * The table it leaves behind is deliberate. Its migration has been applied, so
   * dropping it is a migration a product writes, and the command says so.
   */
  const remove: RehearsalStep = {
    command: `pnpm generate feature --remove ${rehearsalSlices.feature}`,
    name: "remove the slice again",
  };
  log(remove.name);
  const removed = runInherit(
    "pnpm",
    ["generate", "feature", "--remove", rehearsalSlices.feature],
    { cwd: checkout },
  );
  if (removed !== 0) {
    return fail(remove, removed);
  }

  const reverify: RehearsalStep = {
    command: "pnpm verify",
    name: "verify what is left",
  };
  log("verify — the same suite, over a product that changed its mind");
  const reverified = runInherit("pnpm", ["verify"], { cwd: checkout });
  if (reverified !== 0) {
    return fail(reverify, reverified);
  }

  return { checkout, code: 0, failed: undefined };
}

export function discardCheckout(checkout: string): void {
  rmSync(checkout, { force: true, recursive: true });
}
