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

/**
 * spawnSync kills the child once its output passes `maxBuffer`, and the default
 * is one megabyte — less than depcruise's JSON for a repository this size.
 * Nothing here streams, so the ceiling only has to sit comfortably above the
 * largest report.
 */
const captureBufferBytes = 64 * 1024 * 1024;

export function runCapture(
  command: string,
  args: readonly string[],
  options: RunOptions,
): CommandResult {
  const result = spawnSync(command, [...args], {
    cwd: options.cwd,
    encoding: "utf8",
    env: { ...process.env, ...options.env },
    maxBuffer: captureBufferBytes,
    shell: useShell,
  });

  // A spawn error (ENOENT, ENOBUFS) arrives beside whatever the child wrote,
  // and the child's stderr is an empty string rather than null when it ran, so
  // the error is appended instead of used as a fallback — otherwise a killed
  // child reports an exit code and nothing about why.
  const stderr = [result.stderr ?? "", result.error?.message ?? ""]
    .filter((part) => part !== "")
    .join("\n");

  return {
    code: result.status ?? 1,
    stderr,
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
