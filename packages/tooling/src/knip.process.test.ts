import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runCapture } from "./command.ts";
import { repositoryRoot } from "./repository.ts";
import { starterIdentity } from "./starter-identity.ts";

/**
 * `pnpm knip` proven the way stage 01 established every other guardrail: one
 * planted violation per class, in a workspace that is otherwise clean.
 *
 * Knip is spawned as a binary rather than imported, which is what lets this test
 * live in a package that may hold no installed dependency — the same shape
 * `pnpm db:lint` uses for Squawk. It also means the fixture needs no install of
 * its own: every class below is decided from source files and a manifest.
 */

const clean: Readonly<Record<string, string>> = {
  "knip.json": JSON.stringify({
    entry: ["src/main.ts"],
    project: ["src/**/*.ts"],
  }),
  "package.json": JSON.stringify({
    dependencies: { "@scope/used": "^1.0.0" },
    name: "knip-fixture",
    private: true,
    type: "module",
  }),
  "src/main.ts": [
    'import "@scope/used";',
    'import { reachable } from "./reachable.ts";',
    "",
    "console.log(reachable);",
    "",
  ].join("\n"),
  "src/reachable.ts": "export const reachable = 1;\n",
};

/** Each case adds or replaces files in the clean fixture, and what Knip must name. */
const cases = [
  {
    files: { "src/orphan.ts": "export const orphan = 1;\n" },
    name: "a file no entry point reaches",
    reported: "src/orphan.ts",
  },
  {
    files: {
      "src/reachable.ts":
        "export const reachable = 1;\nexport const widened = 2;\n",
    },
    name: "an export nothing imports",
    reported: "widened",
  },
  {
    files: {
      "package.json": JSON.stringify({
        dependencies: { "@scope/unreached": "^1.0.0", "@scope/used": "^1.0.0" },
        name: "knip-fixture",
        private: true,
        type: "module",
      }),
    },
    name: "a dependency nothing imports",
    reported: "@scope/unreached",
  },
  {
    files: {
      "src/main.ts": [
        'import "@scope/used";',
        'import "@scope/undeclared";',
        'import { reachable } from "./reachable.ts";',
        "",
        "console.log(reachable);",
        "",
      ].join("\n"),
    },
    name: "an import no manifest declares",
    reported: "@scope/undeclared",
  },
] as const;

let workspace: string;

function write(directory: string, files: Readonly<Record<string, string>>) {
  for (const [relative, contents] of Object.entries(files)) {
    const absolute = path.join(directory, relative);
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, contents);
  }
}

function knip(directory: string) {
  return runCapture(
    "pnpm",
    ["exec", "knip", "--directory", directory, "--no-progress"],
    { cwd: repositoryRoot },
  );
}

beforeAll(() => {
  // Resolved through `realpath` deliberately. On macOS the system temporary
  // directory is reached through a symlink, and Knip then fails to relate an
  // import to the file it resolves to: every module below the entry point is
  // reported as unreached, naming no cause.
  workspace = realpathSync(mkdtempSync(path.join(tmpdir(), "knip-fixture-")));
});

afterAll(() => {
  rmSync(workspace, { force: true, recursive: true });
});

describe("pnpm knip", () => {
  it("accepts a workspace where everything is reached", () => {
    const directory = path.join(workspace, "clean");
    write(directory, clean);

    expect(knip(directory).code).toBe(0);
  });

  it.each(cases)("reports $name", ({ files, reported }) => {
    const directory = path.join(workspace, reported.replace(/\W+/g, "-"));
    write(directory, clean);
    write(directory, files);

    const result = knip(directory);

    expect(result.code).toBe(1);
    expect(result.stdout).toContain(reported);
  });
}, 120_000);

describe("knip.config.js", () => {
  /**
   * `pnpm starter:init` rewrites the starter scope out of every file, so a
   * config keyed on workspace package names would leave the renamed product
   * with a `knip` step that resolves nothing. Directories and globs survive the
   * rename; names do not.
   */
  it("addresses workspaces by directory, never by package name", () => {
    const config = readFileSync(
      path.join(repositoryRoot, "knip.config.js"),
      "utf8",
    );
    // Comments are where the rule itself is written down, so only what the
    // config actually declares is checked.
    const declarations = config
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");

    expect(declarations).not.toContain(`@${starterIdentity.scope}/`);
  });
});
