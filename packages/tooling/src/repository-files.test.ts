import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { listFiles } from "./repository-files.ts";

let root: string;

function write(relative: string): void {
  const absolute = path.join(root, relative);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, "content\n");
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "repository-files-"));
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

describe("listFiles", () => {
  it("skips coding-agent state under .claude, including nested worktrees", () => {
    write("apps/web/src/page.tsx");
    write(".claude/settings.json");
    write(".claude/worktrees/leftover/packages/api/src/router.ts");

    expect(listFiles(root)).toEqual(["apps/web/src/page.tsx"]);
  });
});
