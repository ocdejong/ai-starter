import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { runCapture, runInherit } from "./command.ts";
import {
  containerPublishingPort,
  containerState,
  createContainer,
  postgresContainerName,
  probeContainerRuntime,
  startContainer,
  type ContainerRuntime,
  type PostgresContainer,
} from "./container-runtime.ts";
import { parseDatabaseUrl, withPort } from "./database-url.ts";
import { parseEnvFile, setEnvValue } from "./env-file.ts";
import { mobileEnvPath, webEnvPath } from "./repository.ts";
import { findFreePort, isPortAccepting, waitForPort } from "./tcp.ts";

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
 * Creates `apps/web/.env` from the example on first run. The database port is
 * moved to the next free one when the example's port is already taken, so
 * several products generated from this starter can run side by side.
 */
async function ensureWebEnvironment(root: string): Promise<string> {
  const absolute = path.join(root, webEnvPath);
  const example = path.join(root, `${webEnvPath}.example`);

  if (!existsSync(absolute)) {
    if (!existsSync(example)) {
      throw new BootstrapError(
        `${webEnvPath}.example is missing.`,
        "Restore the example file from version control.",
      );
    }

    let content = readFileSync(example, "utf8");
    const configured = readDatabaseUrl(content, `${webEnvPath}.example`);
    const connection = parseDatabaseUrl(configured);
    const port = await findFreePort(connection.host, connection.port);

    if (port !== connection.port) {
      log(
        `port ${connection.port} is in use; the local database will use ${port}`,
      );
      content = setEnvValue(
        content,
        "DATABASE_URL",
        withPort(configured, port),
      );
    }

    writeFileSync(absolute, content);
    log(`created ${webEnvPath}`);
  }

  let content = readFileSync(absolute, "utf8");
  if ((parseEnvFile(content).get("BETTER_AUTH_SECRET") ?? "").length < 32) {
    content = setEnvValue(
      content,
      "BETTER_AUTH_SECRET",
      randomBytes(32).toString("base64url"),
    );
    writeFileSync(absolute, content);
    log("generated a local BETTER_AUTH_SECRET");
  }

  return readDatabaseUrl(content, webEnvPath);
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

  if (state === "running") {
    log(`container "${container.name}" is already running`);
  } else if (state === "stopped") {
    requireContainerCommand(
      startContainer(probe.runtime, container, root),
      `start the existing container "${container.name}"`,
    );
    log(`started container "${container.name}"`);
  } else {
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
  }

  await waitForDatabase(probe.runtime, container, connection.host, root);
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
