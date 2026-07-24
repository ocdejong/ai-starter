import { runCapture, type CommandResult } from "./command.ts";

export type ContainerRuntime = "docker" | "podman";

export type RuntimeProbe = {
  readonly runtime: ContainerRuntime | undefined;
  readonly installed: readonly ContainerRuntime[];
};

const candidates: readonly ContainerRuntime[] = ["docker", "podman"];

/** Finds the first installed runtime whose daemon actually answers. */
export function probeContainerRuntime(cwd: string): RuntimeProbe {
  const installed: ContainerRuntime[] = [];
  let runtime: ContainerRuntime | undefined;

  for (const candidate of candidates) {
    if (runCapture(candidate, ["--version"], { cwd }).code !== 0) {
      continue;
    }
    installed.push(candidate);
    runtime ??=
      runCapture(candidate, ["info"], { cwd }).code === 0
        ? candidate
        : undefined;
  }

  return { installed, runtime };
}

export function containerState(
  runtime: ContainerRuntime,
  name: string,
  cwd: string,
): "running" | "stopped" | "absent" {
  const running = runCapture(
    runtime,
    ["ps", "--quiet", "--filter", `name=^${name}$`],
    { cwd },
  );
  if (running.stdout.trim() !== "") {
    return "running";
  }

  const existing = runCapture(
    runtime,
    ["ps", "--all", "--quiet", "--filter", `name=^${name}$`],
    { cwd },
  );
  return existing.stdout.trim() === "" ? "absent" : "stopped";
}

export type PostgresContainer = {
  readonly name: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
  readonly image: string;
};

/** The port PostgreSQL listens on inside the container. */
const postgresContainerPort = 5432;

/** Reads the host port the named container publishes for PostgreSQL. */
export function publishedPort(
  runtime: ContainerRuntime,
  name: string,
  cwd: string,
): number | undefined {
  const result = runCapture(runtime, ["inspect", name], { cwd });
  return result.code === 0 ? parsePublishedPort(result.stdout) : undefined;
}

/**
 * Extracts the published PostgreSQL host port from `inspect` output. A running
 * container reports the live binding under `NetworkSettings.Ports`; a stopped
 * one only carries the creation-time `HostConfig.PortBindings`, so both are
 * accepted, live binding first.
 */
export function parsePublishedPort(inspectOutput: string): number | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(inspectOutput);
  } catch {
    return undefined;
  }

  const container = Array.isArray(parsed) ? asRecord(parsed[0]) : undefined;
  return (
    boundHostPort(asRecord(container?.NetworkSettings)?.Ports) ??
    boundHostPort(asRecord(container?.HostConfig)?.PortBindings)
  );
}

function boundHostPort(portMap: unknown): number | undefined {
  const bindings = asRecord(portMap)?.[`${postgresContainerPort}/tcp`];
  if (!Array.isArray(bindings)) {
    return undefined;
  }

  for (const binding of bindings) {
    const hostPort = Number(asRecord(binding)?.HostPort);
    if (Number.isInteger(hostPort) && hostPort > 0) {
      return hostPort;
    }
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * Every worktree of one repository shares the database name but gets its own
 * port, so the port must be part of the name: without it, sibling worktrees
 * all claim one container and each bootstrap after the first waits on a port
 * that container never publishes.
 */
export function postgresContainerName(database: string, port: number): string {
  return `${database}-postgres-${port}`;
}

/**
 * Names the container publishing a host port, so a port conflict can report
 * its actual owner instead of a bare "something else is listening".
 */
export function containerPublishingPort(
  runtime: ContainerRuntime,
  port: number,
  cwd: string,
): string | undefined {
  const result = runCapture(
    runtime,
    ["ps", "--filter", `publish=${port}`, "--format", "{{.Names}}"],
    { cwd },
  );
  if (result.code !== 0) {
    return undefined;
  }

  const name = result.stdout.trim().split("\n")[0]?.trim();
  return name === undefined || name === "" ? undefined : name;
}

export function startContainer(
  runtime: ContainerRuntime,
  container: PostgresContainer,
  cwd: string,
): CommandResult {
  return runCapture(runtime, ["start", container.name], { cwd });
}

export function createContainer(
  runtime: ContainerRuntime,
  container: PostgresContainer,
  cwd: string,
): CommandResult {
  return runCapture(
    runtime,
    [
      "run",
      "--detach",
      "--name",
      container.name,
      "--env",
      `POSTGRES_USER=${container.user}`,
      "--env",
      `POSTGRES_PASSWORD=${container.password}`,
      "--env",
      `POSTGRES_DB=${container.database}`,
      "--publish",
      `${container.port}:${postgresContainerPort}`,
      container.image,
    ],
    { cwd },
  );
}
