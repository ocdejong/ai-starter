import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { runCapture } from "./command.ts";
import { repositoryPath, repositoryRoot } from "./repository.ts";

/**
 * The graph guard runs the real `.dependency-cruiser.cjs` two ways. Against the
 * repository it must stay green, so a genuine boundary regression fails `pnpm arch`.
 * Against planted fixtures every rule must still fire with the offending file named,
 * so a rule that quietly stops matching is a failing test — the same shape as
 * `instruction-policy.test.ts`.
 */

const require = createRequire(import.meta.url);
const configPath = repositoryPath(".dependency-cruiser.cjs");
const depcruiseBin = repositoryPath(
  "node_modules",
  ".bin",
  process.platform === "win32" ? "depcruise.cmd" : "depcruise",
);

type Rule = { readonly name: string };
type ForbiddenConfig = {
  readonly forbidden: readonly Rule[];
  readonly options: object;
};

const realConfig = require(configPath) as ForbiddenConfig;

const configuredRules = new Set(realConfig.forbidden.map((rule) => rule.name));

type Violation = {
  readonly rule: { readonly name: string };
  readonly from: string;
};

type CruiseResult = {
  readonly summary: {
    readonly error: number;
    readonly violations: readonly Violation[];
  };
};

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

function write(root: string, file: string, content: string): void {
  const absolute = path.join(root, file);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf8");
}

/** Runs the real ruleset against `targets`, resolved relative to `cwd`. */
function cruise(
  cwd: string,
  config: string,
  targets: readonly string[],
): CruiseResult {
  const result = runCapture(
    depcruiseBin,
    ["--config", config, "--output-type", "json", ...targets],
    { cwd },
  );

  const parsed: unknown = JSON.parse(result.stdout);
  return parsed as CruiseResult;
}

/**
 * A fixture tree that mirrors the repository layout so the real `from` selectors
 * (`^packages/domain/src`, `^apps/web/src/(app|trpc)/`) match. It reuses the real
 * `forbidden` rules through a config that drops only `tsConfig`, which points at a
 * repository file the fixture does not have; boundary rules match the raw specifier
 * and cycles resolve through relative imports, so neither needs it.
 */
function plantAndCruise(
  files: Readonly<Record<string, string>>,
): readonly Violation[] {
  const root = mkdtempSync(path.join(tmpdir(), "arch-fixture-"));
  temporaryRoots.push(root);

  for (const [file, content] of Object.entries(files)) {
    write(root, file, content);
  }

  const options: Record<string, unknown> = { ...realConfig.options };
  delete options.tsConfig;
  write(
    root,
    "dc.cjs",
    `module.exports = ${JSON.stringify({ forbidden: realConfig.forbidden, options })};`,
  );

  const targets = [
    ...new Set(Object.keys(files).map((file) => file.split("/")[0] ?? file)),
  ];
  return cruise(root, path.join(root, "dc.cjs"), targets).summary.violations;
}

/** One planted violation per rule: the offending file, and the rule it must trip. */
const cases = [
  {
    rule: "no-circular",
    from: "cyc/one.ts",
    files: {
      "cyc/one.ts":
        'import { b } from "./two.ts";\nexport const a = () => b;\n',
      "cyc/two.ts":
        'import { a } from "./one.ts";\nexport const b = () => a;\n',
    },
  },
  {
    rule: "no-deep-package-imports",
    from: "packages/api/src/deep.ts",
    files: {
      "packages/api/src/deep.ts":
        'import { post } from "@ai-starter/domain/src/post";\nexport const p = post;\n',
    },
  },
  {
    rule: "domain-stays-platform-neutral",
    from: "packages/domain/src/bad.ts",
    files: {
      "packages/domain/src/bad.ts":
        'import { db } from "@ai-starter/db";\nexport const x = db;\n',
    },
  },
  {
    rule: "tokens-stay-plain-data",
    from: "packages/tokens/src/bad.ts",
    files: {
      "packages/tokens/src/bad.ts":
        'import { useState } from "react";\nexport const x = useState;\n',
    },
  },
  {
    rule: "db-stays-below-the-api",
    from: "packages/db/src/bad.ts",
    files: {
      "packages/db/src/bad.ts":
        'import { appRouter } from "@ai-starter/api";\nexport const r = appRouter;\n',
    },
  },
  {
    rule: "api-stays-framework-free",
    from: "packages/api/src/bad.ts",
    files: {
      "packages/api/src/bad.ts":
        'import { PrismaClient } from "@prisma/client";\nexport const c = PrismaClient;\n',
    },
  },
  {
    rule: "mobile-uses-only-the-api-client",
    from: "apps/mobile/src/bad.ts",
    files: {
      "apps/mobile/src/bad.ts":
        'import { db } from "@ai-starter/db";\nexport const x = db;\n',
    },
  },
  {
    rule: "mobile-api-is-client-entry-only",
    from: "apps/mobile/src/entry.ts",
    files: {
      "apps/mobile/src/entry.ts":
        'import { appRouter } from "@ai-starter/api";\nexport const r = appRouter;\n',
    },
  },
  {
    rule: "web-ui-and-transport-avoid-the-database",
    from: "apps/web/src/app/bad.ts",
    files: {
      "apps/web/src/app/bad.ts":
        'import { db } from "@ai-starter/db";\nexport const x = db;\n',
    },
  },
] as const;

describe("architecture graph rules", () => {
  it("accepts this repository", () => {
    const result = cruise(repositoryRoot, configPath, ["apps", "packages"]);
    const named = result.summary.violations.map(
      (violation) => `${violation.rule.name}: ${violation.from}`,
    );
    expect(named).toEqual([]);
  });

  it.each(cases)(
    "reports $rule and names the offending file",
    ({ rule, from, files }) => {
      const violations = plantAndCruise(files);
      const forFile = violations.filter((violation) => violation.from === from);

      expect(forFile.map((violation) => violation.rule.name)).toContain(rule);
    },
  );

  it("has a planted fixture for every configured rule", () => {
    const covered = new Set<string>(cases.map((testCase) => testCase.rule));
    const uncovered = [...configuredRules].filter((rule) => !covered.has(rule));

    expect(uncovered).toEqual([]);
  });

  it("only asserts rules that the configuration still defines", () => {
    const undefinedRules = cases
      .map((testCase) => testCase.rule)
      .filter((rule) => !configuredRules.has(rule));

    expect(undefinedRules).toEqual([]);
  });
});
