import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { repositoryRoot } from "./repository.ts";
import {
  allowedSuppressions,
  checkSuppressionRatchet,
  countSuppressions,
} from "./suppression-ratchet.ts";

/**
 * A ratchet is only a ratchet if it fails in both directions, so both are
 * planted: a suppression that appears where none was allowed, and an allowance
 * left standing after the suppression it covered was removed.
 */

const workspaces: string[] = [];

function checkout(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(path.join(tmpdir(), "ratchet-"));
  workspaces.push(root);

  for (const [relative, contents] of Object.entries(files)) {
    const absolute = path.join(root, relative);
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, contents);
  }

  return root;
}

afterAll(() => {
  for (const workspace of workspaces) {
    rmSync(workspace, { force: true, recursive: true });
  }
});

describe("countSuppressions", () => {
  it("counts a directive only where it silences something", () => {
    const root = checkout({
      "src/comments.ts": [
        "// @ts-expect-error the upstream type is wrong",
        "export const a = 1;",
        "/* eslint-disable-next-line no-console -- the CLI prints here */",
        "export const b = 2;",
        "// @ts-ignore",
        "export const c = 3;",
      ].join("\n"),
      "src/prose.ts": [
        "// Explains that @ts-expect-error must carry a reason, in prose.",
        "export const mentions = 1;",
      ].join("\n"),
    });

    // A directive only silences anything when it opens the comment. Prose that
    // names one in passing is how this module's own documentation is written,
    // and counting that would make every explanation cost a budget.
    expect(countSuppressions(root)).toEqual(new Map([["src/comments.ts", 3]]));
  });

  it("counts test files, which the bypass checker does not read", () => {
    const root = checkout({
      "src/thing.test.ts":
        "// @ts-expect-error proving something\nexport const a = 1;\n",
    });

    expect(countSuppressions(root).get("src/thing.test.ts")).toBe(1);
  });
});

describe("checkSuppressionRatchet", () => {
  it("reports a suppression in a file with no allowance", () => {
    const root = checkout({
      "src/new.ts":
        "// @ts-expect-error a fresh exception\nexport const a = 1;\n",
    });

    const [violation] = checkSuppressionRatchet(root);

    expect(violation?.file).toBe("src/new.ts");
    expect(violation?.problem).toContain("no allowance");
    expect(violation?.fix).toContain("allowedSuppressions");
  });

  it("reports an allowance the repository has outgrown downwards", () => {
    // Nothing here carries a suppression, so every committed allowance is now
    // larger than what the checkout contains — which is the improvement a
    // ratchet exists to make somebody record.
    const violations = checkSuppressionRatchet(
      checkout({ "src/a.ts": "export const a = 1;\n" }),
    );

    expect(violations).not.toHaveLength(0);
    expect(violations[0]?.problem).toContain("A ratchet only counts");
    expect(violations[0]?.fix).toContain("drop its entry entirely");
  });

  it("accepts this repository", () => {
    expect(checkSuppressionRatchet(repositoryRoot)).toEqual([]);
  });
});

describe("allowedSuppressions", () => {
  it("names only files this repository still carries", () => {
    for (const entry of allowedSuppressions) {
      expect(existsSync(path.join(repositoryRoot, entry.file))).toBe(true);
    }
  });

  // The count alone cannot tell a genuine exception from a planted fixture, and
  // an unexplained allowance is a budget the next reader will assume is spent.
  it("says why each allowance exists", () => {
    for (const entry of allowedSuppressions) {
      expect(entry.reason.length).toBeGreaterThan(30);
    }
  });

  it("does not grow", () => {
    const total = allowedSuppressions.reduce(
      (sum, entry) => sum + entry.count,
      0,
    );

    expect(total).toBeLessThanOrEqual(14);
  });
});
