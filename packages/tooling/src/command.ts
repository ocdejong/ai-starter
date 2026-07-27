import { spawnSync } from "node:child_process";

export type CommandResult = {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
};

/**
 * Windows resolves `pnpm`, `docker` and `git` through shim scripts that only a
 * shell can execute, so the shell is enabled there and nowhere else.
 */
const useShell = process.platform === "win32";

export type RunOptions = {
  readonly cwd: string;
  readonly env?: Readonly<Record<string, string>> | undefined;
};

export function runCapture(
  command: string,
  args: readonly string[],
  options: RunOptions,
): CommandResult {
  const result = spawnSync(command, [...args], {
    cwd: options.cwd,
    encoding: "utf8",
    env: { ...process.env, ...options.env },
    shell: useShell,
  });

  return {
    code: result.status ?? 1,
    stderr: result.stderr ?? result.error?.message ?? "",
    stdout: result.stdout ?? "",
  };
}

/** Streams the child process output so long-running checks stay observable. */
export function runInherit(
  command: string,
  args: readonly string[],
  options: RunOptions,
): number {
  const result = spawnSync(command, [...args], {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    shell: useShell,
    stdio: "inherit",
  });

  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
    return 1;
  }

  return result.status ?? 1;
}
