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
      `${container.port}:5432`,
      container.image,
    ],
    { cwd },
  );
}
