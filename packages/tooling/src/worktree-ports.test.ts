import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  deriveWebOrigin,
  isLinkedWorktree,
  worktreePortOffset,
  worktreePortSpread,
} from "./worktree-ports.ts";

describe("worktreePortOffset", () => {
  it("returns the same offset for the same root on every call", () => {
    const root = "/Users/dev/product/.claude/worktrees/frosty-sammet-5c8e65";

    expect(worktreePortOffset(root)).toBe(worktreePortOffset(root));
  });

  it("stays within [1, worktreePortSpread]", () => {
    const names = ["a", "stage13", "sharp-gould-86efd5", "frosty-sammet"];

    for (const name of names) {
      const offset = worktreePortOffset(
        path.join("/Users/dev/product/.claude/worktrees", name),
      );
      expect(offset).toBeGreaterThanOrEqual(1);
      expect(offset).toBeLessThanOrEqual(worktreePortSpread);
    }
  });

  it("separates the two live worktrees that shared port 5436", () => {
    // The incident this module exists for: both of these worktrees
    // bootstrapped onto localhost:5436, so their e2e runs wrote into one
    // database and corrupted each other's journeys.
    const first = worktreePortOffset(
      "/Users/ocdejong/Development/ai-starter/.claude/worktrees/ecstatic-tesla-e09b8a",
    );
    const second = worktreePortOffset(
      "/Users/ocdejong/Development/ai-starter/.claude/worktrees/exciting-herschel-41017d",
    );

    expect(first).not.toBe(second);
  });
});

describe("isLinkedWorktree", () => {
  let root: string;

  afterEach(() => {
    rmSync(root, { force: true, recursive: true });
  });

  it("recognises a linked worktree by its .git file", () => {
    root = mkdtempSync(path.join(tmpdir(), "worktree-ports-"));
    writeFileSync(
      path.join(root, ".git"),
      "gitdir: /elsewhere/.git/worktrees/example\n",
    );

    expect(isLinkedWorktree(root)).toBe(true);
  });

  it("treats a .git directory as a primary checkout", () => {
    root = mkdtempSync(path.join(tmpdir(), "worktree-ports-"));
    mkdirSync(path.join(root, ".git"));

    expect(isLinkedWorktree(root)).toBe(false);
  });

  it("treats a directory without .git as a primary checkout", () => {
    root = mkdtempSync(path.join(tmpdir(), "worktree-ports-"));

    expect(isLinkedWorktree(root)).toBe(false);
  });
});

describe("deriveWebOrigin", () => {
  it("moves the explicit port by the offset", () => {
    expect(deriveWebOrigin("http://localhost:3000", 7)).toBe(
      "http://localhost:3007",
    );
  });

  it("declines a URL without an explicit port", () => {
    expect(deriveWebOrigin("http://localhost", 7)).toBeUndefined();
  });

  it("declines an unparsable value", () => {
    expect(deriveWebOrigin("not a url", 7)).toBeUndefined();
  });

  it("declines a missing value", () => {
    expect(deriveWebOrigin(undefined, 7)).toBeUndefined();
    expect(deriveWebOrigin("", 7)).toBeUndefined();
  });
});
