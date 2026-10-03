import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { changedPaths } from "./git.ts";

const fixtures: string[] = [];

afterEach(() => {
  for (const directory of fixtures.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

/** A repository with one commit holding `docs/guide.md`. */
function repository(): { root: string; git: (...args: string[]) => void } {
  const root = mkdtempSync(path.join(tmpdir(), "git-"));
  fixtures.push(root);
  const git = (...args: string[]): void => {
    const result = spawnSync("git", args, {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_AUTHOR_EMAIL: "fixture@example.com",
        GIT_AUTHOR_NAME: "fixture",
        GIT_COMMITTER_EMAIL: "fixture@example.com",
        GIT_COMMITTER_NAME: "fixture",
      },
    });
    if (result.status !== 0) {
      throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
    }
  };
  mkdirSync(path.join(root, "docs"));
  writeFileSync(path.join(root, "docs/guide.md"), "a guide\n");
  git("init", "--quiet", "--initial-branch=main");
  git("add", ".");
  git("commit", "--quiet", "--message", "base");
  return { git, root };
}

describe("changedPaths", () => {
  // A file moved out of a watched prefix still selects what that prefix owns.
  it("lists both paths of a renamed file, committed or not", () => {
    const { git, root } = repository();
    mkdirSync(path.join(root, "packages"));
    git("mv", "docs/guide.md", "packages/guide.md");
    git("commit", "--quiet", "--message", "move");
    git("mv", "packages/guide.md", "guide.md");

    expect(changedPaths(root, "HEAD~1")).toEqual([
      "docs/guide.md",
      "guide.md",
      "packages/guide.md",
    ]);
  });
});
