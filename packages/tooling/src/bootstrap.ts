import { randomBytes } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { runCapture, runInherit } from "./command.ts";
import {
  containerPublishingPort,
  containerState,
  createContainer,
  postgresContainerName,
  probeContainerRuntime,
  publishedPort,
  startContainer,
  type ContainerRuntime,
  type PostgresContainer,
} from "./container-runtime.ts";
import { parseDatabaseUrl, withPort } from "./database-url.ts";
import { parseEnvFile, setEnvValue } from "./env-file.ts";
import { mobileEnvPath, webEnvPath } from "./repository.ts";
import { findFreePort, isPortAccepting, waitForPort } from "./tcp.ts";
import {
  deriveWebOrigin,
  isLinkedWorktree,
  unclaimedWorktreeOffset,
  worktreePortOffset,
} from "./worktree-ports.ts";

/** Matches the PostgreSQL image the CI workflow runs against. */
const postgresImage = "docker.io/postgres:17-alpine";
const readinessTimeoutMs = 90_000;

/**
 * Carries the corrective action alongside the failure. Declared as a plain
 * field assignment because Node runs these files by stripping types, which
 * rejects TypeScript parameter properties.
 */
export class BootstrapError extends Error {
  readonly fix: string;

  constructor(message: string, fix: string) {
    super(message);
    this.fix = fix;
  }
}

function log(message: string): void {
  console.log(`bootstrap: ${message}`);
}

/**
 * Takes a clean checkout to a runnable, migrated local environment. Every step
 * checks the state it is about to create, so repeated runs converge instead of
 * failing or duplicating work.
 */
export async function runBootstrap(root: string): Promise<void> {
  const databaseUrl = await ensureWebEnvironment(root);
  ensureMobileEnvironment(root);

  log("installing workspace dependencies");
  requireSuccess(
    runInherit("pnpm", ["install"], { cwd: root }),
    "pnpm install",
  );

  await ensureDatabase(root, databaseUrl);

  log("generating the Prisma client");
  requireSuccess(
    runInherit("pnpm", ["db:generate"], { cwd: root }),
    "pnpm db:generate",
  );

  log("applying migrations");
  requireSuccess(
    runInherit("pnpm", ["db:migrate"], { cwd: root }),
    "pnpm db:migrate",
  );

  log("seeding the demo sign-in");
  requireSuccess(
    runInherit("pnpm", ["db:seed"], { cwd: root }),
    "pnpm db:seed",
  );

  log("ready — run `pnpm verify` for the authoritative check suite");
}

function requireSuccess(code: number, command: string): void {
  if (code !== 0) {
    throw new BootstrapError(
      `\`${command}\` exited with code ${code}.`,
      "Read the output above, resolve the reported cause, then run `pnpm bootstrap` again.",
    );
  }
}

/**
 * Brings `apps/web/.env` to the state this checkout needs, creating it from the
 * example on first run. In a linked worktree the web origin and the database
 * are then settled on every run rather than only at creation, so a worktree
 * whose file predates that rule — or was copied from another checkout for its
 * secrets — converges instead of sharing that checkout's values forever. See
 * `settleWorktreeValues` for the rule. `siblings` are the other checkouts of
 * this repository; a parameter so the rule can be exercised on fixture trees.
 */
export async function ensureWebEnvironment(
  root: string,
  siblings: readonly string[] = siblingCheckouts(root),
): Promise<string> {
  const absolute = path.join(root, webEnvPath);
  const example = path.join(root, `${webEnvPath}.example`);
  const linked = isLinkedWorktree(root);

  let content = readFileIfPresent(absolute);
  if (content === undefined) {
    content = linked
      ? readExample(example)
      : await primaryEnvironmentFromExample(example);
    writeFileSync(absolute, content);
    log(`created ${webEnvPath}`);
  }

  let settled = linked
    ? await settleWorktreeValues(root, content, example, siblings)
    : content;

  if ((parseEnvFile(content).get("BETTER_AUTH_SECRET") ?? "").length < 32) {
    settled = setEnvValue(
      settled,
      "BETTER_AUTH_SECRET",
      randomBytes(32).toString("base64url"),
    );
    log("generated a local BETTER_AUTH_SECRET");
  }

  if (settled !== content) {
    writeFileSync(absolute, settled);
    content = settled;
  }

  return readDatabaseUrl(content, webEnvPath);
}

/**
 * A file's contents, or undefined when it is not there. Reading and handling
 * the failure gives the same answer as asking first, without the window
 * between the question and the read in which the answer can stop being true.
 */
function readFileIfPresent(file: string): string | undefined {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
}

function readExample(examplePath: string): string {
  const example = readFileIfPresent(examplePath);
  if (example === undefined) {
    throw new BootstrapError(
      `${webEnvPath}.example is missing.`,
      "Restore the example file from version control.",
    );
  }
  return example;
}

/**
 * The `.env` a fresh primary checkout starts from. The database port moves to
 * the next free one when the example's is already taken, so several products
 * generated from this starter can run side by side.
 */
async function primaryEnvironmentFromExample(
  examplePath: string,
): Promise<string> {
  const example = readExample(examplePath);
  const configured = readDatabaseUrl(example, `${webEnvPath}.example`);
  const connection = parseDatabaseUrl(configured);
  const port = await findFreePort(connection.host, connection.port);

  if (port === connection.port) {
    return example;
  }
  log(`port ${connection.port} is in use; the local database will use ${port}`);
  return setEnvValue(example, "DATABASE_URL", withPort(configured, port));
}

/**
 * The other checkouts of this repository — the primary one and every linked
 * worktree but this — as git lists them. A checkout git cannot list for (no
 * git, or a fixture whose `.git` points nowhere) has none: the rule below
 * then falls back to the example comparison alone.
 */
function siblingCheckouts(root: string): string[] {
  const listing = runCapture("git", ["worktree", "list", "--porcelain"], {
    cwd: root,
  });
  if (listing.code !== 0) {
    return [];
  }
  const self = canonicalPath(root);
  return listing.stdout
    .split("\n")
    .filter((line) => line.startsWith("worktree "))
    .map((line) => line.slice("worktree ".length))
    .filter((checkout) => canonicalPath(checkout) !== self);
}

function canonicalPath(file: string): string {
  try {
    return realpathSync(file);
  } catch {
    return path.resolve(file);
  }
}

/** The explicit port a URL names, or undefined when it names none. */
function urlPort(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  try {
    const port = new URL(value).port;
    return port === "" ? undefined : Number(port);
  } catch {
    return undefined;
  }
}

function databasePort(value: string | undefined): number | undefined {
  if (value === undefined || value === "") return undefined;
  try {
    return parseDatabaseUrl(value).port;
  } catch {
    return undefined;
  }
}

/**
 * The local ports another checkout's `.env` already names: its web origin and
 * its database.
 */
function claimedPorts(siblings: readonly string[]): Set<number> {
  const claimed: (number | undefined)[] = [];
  for (const sibling of siblings) {
    const content = readFileIfPresent(path.join(sibling, webEnvPath));
    if (content === undefined) continue;
    const env = parseEnvFile(content);
    claimed.push(
      urlPort(env.get("BETTER_AUTH_URL")),
      databasePort(env.get("DATABASE_URL")),
    );
  }
  return new Set(claimed.filter((port) => port !== undefined));
}

/**
 * Re-points a linked worktree's web origin and database at its own when the
 * values its `.env` names are not its own: the example's, which every
 * checkout starts from, or another checkout's, which is what copying a
 * sibling's file for its secrets produces. Deriving on every run rather than
 * only where the file is created is what makes the rule converge, and two
 * checkouts on one value is not cosmetic: Playwright's `reuseExistingServer`
 * attaches to whichever dev server reached the origin first and asserts
 * against that checkout's application, and the browser lane migrates the
 * database it names, so one branch's unmerged migration becomes a sibling's
 * schema.
 *
 * Both move by one offset: the path's own hash, stepped past any offset whose
 * port another checkout already holds, so a hash collision between two paths
 * resolves the moment the second of them bootstraps. Of two copies, the one
 * that bootstraps first moves and the other then finds itself alone. Nothing
 * is stranded by moving: data at the old port belongs to the checkout whose
 * container it is, and the same bootstrap run creates and migrates this one's.
 * A value a developer chose — neither the example's nor claimed — survives.
 *
 * The example is read rather than checked for first: a missing one is the same
 * answer as one naming nothing, and asking before reading would be a check
 * whose result the read cannot rely on.
 */
async function settleWorktreeValues(
  root: string,
  content: string,
  examplePath: string,
  siblings: readonly string[],
): Promise<string> {
  const example = readFileIfPresent(examplePath);
  if (example === undefined) {
    return content;
  }

  const shared = parseEnvFile(example);
  const own = parseEnvFile(content);
  const claimed = claimedPorts(siblings);
  const sharedOrigin = shared.get("BETTER_AUTH_URL");
  const sharedDatabase = shared.get("DATABASE_URL");
  const origin = own.get("BETTER_AUTH_URL");
  const database = own.get("DATABASE_URL");

  const examplePorts = [urlPort(sharedOrigin), databasePort(sharedDatabase)];
  const offset = unclaimedWorktreeOffset(
    worktreePortOffset(root),
    (candidate) =>
      examplePorts.some(
        (port) => port !== undefined && claimed.has(port + candidate),
      ),
  );
  const notOwn = (
    value: string | undefined,
    sharedValue: string | undefined,
    port: number | undefined,
  ) =>
    value !== undefined &&
    (value === sharedValue || (port !== undefined && claimed.has(port)));

  let settled = content;

  if (notOwn(origin, sharedOrigin, urlPort(origin))) {
    const derived = deriveWebOrigin(sharedOrigin, offset);
    if (derived !== undefined && derived !== origin) {
      settled = setEnvValue(settled, "BETTER_AUTH_URL", derived);
      log(`the web app in this worktree defaults to ${derived}`);
    }
  }

  const exampleDatabase = databasePort(sharedDatabase);
  if (
    database !== undefined &&
    exampleDatabase !== undefined &&
    notOwn(database, sharedDatabase, databasePort(database))
  ) {
    const port = await findFreePort(
      parseDatabaseUrl(database).host,
      exampleDatabase + offset,
    );
    settled = setEnvValue(settled, "DATABASE_URL", withPort(database, port));
    log(`linked worktree; the local database gets its own port ${port}`);
  }

  return settled;
}

function readDatabaseUrl(content: string, source: string): string {
  const value = parseEnvFile(content).get("DATABASE_URL");
  if (value === undefined || value === "") {
    throw new BootstrapError(
      `${source} does not set DATABASE_URL.`,
      "Add a postgresql:// connection string to that file.",
    );
  }
  return value;
}

function ensureMobileEnvironment(root: string): void {
  const absolute = path.join(root, mobileEnvPath);
  const example = path.join(root, `${mobileEnvPath}.example`);

  if (!existsSync(absolute) && existsSync(example)) {
    copyFileSync(example, absolute);
    log(`created ${mobileEnvPath}`);
  }
}

async function ensureDatabase(
  root: string,
  databaseUrl: string,
): Promise<void> {
  const connection = parseDatabaseUrl(databaseUrl);
  const container: PostgresContainer = {
    database: connection.database,
    image: postgresImage,
    name: postgresContainerName(connection.database, connection.port),
    password: connection.password,
    port: connection.port,
    user: connection.user,
  };

  const probe = probeContainerRuntime(root);
  if (probe.runtime === undefined) {
    if (await isPortAccepting(connection.host, connection.port, 2000)) {
      log(
        `no container runtime found, but ${connection.host}:${connection.port} already answers; using it`,
      );
      return;
    }
    throw new BootstrapError(
      "No running Docker or Podman was found and no PostgreSQL is listening on the configured port.",
      "Start Docker Desktop or Podman, or point DATABASE_URL at a PostgreSQL you manage yourself.",
    );
  }

  const state = containerState(probe.runtime, container.name, root);

  if (state === "absent") {
    if (await isPortAccepting(connection.host, connection.port, 2000)) {
      const occupant = containerPublishingPort(
        probe.runtime,
        connection.port,
        root,
      );
      if (occupant !== undefined) {
        throw new BootstrapError(
          `Port ${connection.port} is published by container "${occupant}", not by the expected "${container.name}".`,
          `"${occupant}" is likely a PostgreSQL from an earlier bootstrap or an orphaned worktree. Remove it with \`${probe.runtime} rm --force ${occupant}\` (this discards its data) or move the DATABASE_URL port in ${webEnvPath} to a free one, then run \`pnpm bootstrap\` again.`,
        );
      }
      throw new BootstrapError(
        `Port ${connection.port} is already in use by something other than "${container.name}".`,
        `Free the port, or change the DATABASE_URL port in ${webEnvPath}.`,
      );
    }
    requireContainerCommand(
      createContainer(probe.runtime, container, root),
      `create the container "${container.name}"`,
    );
    log(`created container "${container.name}" on port ${container.port}`);
  } else {
    const conflict = publishedPortConflict(
      probe.runtime,
      container,
      publishedPort(probe.runtime, container.name, root),
    );
    if (conflict !== undefined) {
      throw conflict;
    }
    if (state === "running") {
      log(`container "${container.name}" is already running`);
    } else {
      requireContainerCommand(
        startContainer(probe.runtime, container, root),
        `start the existing container "${container.name}"`,
      );
      log(`started container "${container.name}"`);
    }
  }

  await waitForDatabase(probe.runtime, container, connection.host, root);
}

/**
 * The container's name embeds the port `apps/web/.env` configures, so a
 * container found under that name must publish exactly that port. A different
 * published port means the container was created or altered outside
 * bootstrap; waiting on the configured port would time out after 90 seconds,
 * so bootstrap stops immediately, naming both ports and the way out.
 */
export function publishedPortConflict(
  runtime: ContainerRuntime,
  container: PostgresContainer,
  published: number | undefined,
): BootstrapError | undefined {
  if (published === undefined || published === container.port) {
    return undefined;
  }

  return new BootstrapError(
    `Container "${container.name}" publishes host port ${published}, not the ${container.port} that ${webEnvPath} configures.`,
    `Remove the container with \`${runtime} rm --force ${container.name}\` (this discards its data), or set the DATABASE_URL port in ${webEnvPath} to ${published}, then run \`pnpm bootstrap\` again.`,
  );
}

function requireContainerCommand(
  result: { code: number; stderr: string },
  action: string,
): void {
  if (result.code !== 0) {
    throw new BootstrapError(
      `Failed to ${action}: ${result.stderr.trim()}`,
      "Check the container runtime state, then run `pnpm bootstrap` again.",
    );
  }
}

/**
 * An open port is not the same as an initialised cluster: PostgreSQL restarts
 * once during first-run initialisation, so readiness is confirmed with
 * `pg_isready` inside the container before migrations are applied.
 */
async function waitForDatabase(
  runtime: ContainerRuntime,
  container: PostgresContainer,
  host: string,
  root: string,
): Promise<void> {
  if (!(await waitForPort(host, container.port, readinessTimeoutMs))) {
    throw new BootstrapError(
      `PostgreSQL did not start listening on ${host}:${container.port}.`,
      `Inspect the container with \`${runtime} logs ${container.name}\`.`,
    );
  }

  const deadline = Date.now() + readinessTimeoutMs;
  while (Date.now() < deadline) {
    const ready = runCapture(
      runtime,
      [
        "exec",
        container.name,
        "pg_isready",
        "--username",
        container.user,
        "--dbname",
        container.database,
      ],
      { cwd: root },
    );

    if (ready.code === 0) {
      log(`database "${container.database}" is accepting connections`);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new BootstrapError(
    `PostgreSQL in "${container.name}" never became ready.`,
    `Inspect the container with \`${runtime} logs ${container.name}\`.`,
  );
}
