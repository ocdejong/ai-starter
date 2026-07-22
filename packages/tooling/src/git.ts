import { runCapture } from "./command.ts";

export class GitError extends Error {}

/**
 * Picks the first candidate revision git can resolve. The merge base with the
 * upstream default branch is preferred so a feature branch is compared against
 * the commit it diverged from rather than the tip of `main`.
 */
export function resolveBase(root: string, requested?: string): string {
  const candidates =
    requested === undefined
      ? [mergeBase(root, "origin/main"), mergeBase(root, "main"), "HEAD~1"]
      : [requested];

  for (const candidate of candidates) {
    if (candidate !== undefined && revisionExists(root, candidate)) {
      return candidate;
    }
  }

  throw new GitError(
    `Could not resolve a base revision${requested === undefined ? "" : ` for "${requested}"`}.`,
  );
}

function mergeBase(root: string, revision: string): string | undefined {
  const result = runCapture("git", ["merge-base", "HEAD", revision], {
    cwd: root,
  });
  return result.code === 0 ? result.stdout.trim() : undefined;
}

function revisionExists(root: string, revision: string): boolean {
  return (
    runCapture("git", ["rev-parse", "--verify", `${revision}^{commit}`], {
      cwd: root,
    }).code === 0
  );
}

/**
 * Committed changes since the base plus anything currently uncommitted, so a
 * work-in-progress edit selects the same checks as the eventual commit.
 */
export function changedPaths(root: string, base: string): string[] {
  const committed = requireGit(
    runCapture("git", ["diff", "--name-only", `${base}...HEAD`], { cwd: root }),
    "git diff",
  );
  const working = requireGit(
    runCapture("git", ["status", "--porcelain=v1"], { cwd: root }),
    "git status",
  );

  const paths = new Set(splitLines(committed));
  for (const line of splitLines(working)) {
    const withoutStatus = line.slice(3);
    const renameArrow = withoutStatus.indexOf(" -> ");
    paths.add(
      renameArrow === -1 ? withoutStatus : withoutStatus.slice(renameArrow + 4),
    );
  }

  return [...paths].filter((entry) => entry !== "").sort();
}

function requireGit(
  result: { code: number; stdout: string; stderr: string },
  command: string,
): string {
  if (result.code !== 0) {
    throw new GitError(`\`${command}\` failed: ${result.stderr.trim()}`);
  }
  return result.stdout;
}

function splitLines(value: string): string[] {
  return value.split("\n").map((line) => line.trimEnd());
}
