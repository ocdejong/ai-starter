import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { repositoryRoot } from "./repository.ts";
import {
  requireStep,
  selectVerificationLane,
  verificationLanes,
  runVerification,
  verificationSteps,
} from "./verification.ts";

const position = (name: string): number =>
  verificationSteps.findIndex((step) => step.name === name);

describe("verificationSteps", () => {
  // The generated Prisma client is an input to every step that compiles
  // TypeScript. A checkout whose client predates a pulled schema change must
  // be healed by the suite itself — otherwise typecheck fails with property
  // errors that never name `pnpm db:generate` as the fix.
  it("regenerates the Prisma client before anything compiles against it", () => {
    expect(position("db:generate")).toBeGreaterThan(-1);
    expect(position("db:generate")).toBeLessThan(position("lint"));
    expect(position("db:generate")).toBeLessThan(position("typecheck"));
  });

  // Knip resolves imports rather than compiling them, but `packages/db` imports
  // the client Prisma generates — so without this ordering it reports the whole
  // package as unreachable on a checkout that has not generated one.
  it("resolves the generated client before asking what nothing reaches", () => {
    expect(position("knip")).toBeGreaterThan(position("db:generate"));
  });

  it("validates the schema before generating a client from it", () => {
    expect(position("db:validate")).toBeGreaterThan(-1);
    expect(position("db:validate")).toBeLessThan(position("db:generate"));
  });

  // Squawk reads the migration SQL, so it costs nothing but a file read and
  // belongs with the other cheap deterministic gates — long before a container
  // is started to apply the migration it just judged.
  it("lints migrations before anything applies them", () => {
    expect(position("db:lint")).toBeGreaterThan(-1);
    expect(position("db:lint")).toBeLessThan(position("test:integration"));
    expect(position("db:lint")).toBeLessThan(position("db:migrate"));
  });

  // Nothing ran the native flow for two stages and it rotted. It is in the list
  // so `pnpm verify` reaches it on a machine that can run it, and it skips
  // loudly — never silently — everywhere else.
  it("ends with the native journey", () => {
    expect(position("test:e2e:mobile")).toBe(verificationSteps.length - 1);
  });

  // Prettier's own failure output says "Run Prettier with --write to fix"
  // without naming a script, so the step must supply the runnable command.
  it("gives the formatting gate a fix command", () => {
    expect(requireStep("format:check").fix).toBe("pnpm format");
  });

  it("names only fix commands that exist as root scripts", () => {
    const manifest = JSON.parse(
      readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };

    for (const step of verificationSteps) {
      if (step.fix === undefined) {
        continue;
      }
      expect(step.fix).toMatch(/^pnpm /);
      expect(Object.keys(manifest.scripts)).toContain(
        step.fix.replace("pnpm ", ""),
      );
    }
  });
});

describe("runVerification", () => {
  it("passes a step's environment only to that command", () => {
    const outcome = runVerification(repositoryRoot, [
      {
        args: [
          "-e",
          "process.exit(process.env.VERIFY_TEST_MODE === 'built' ? 0 : 1)",
        ],
        command: process.execPath,
        env: { VERIFY_TEST_MODE: "built" },
        name: "with environment",
      },
      {
        args: [
          "-e",
          "process.exit(process.env.VERIFY_TEST_MODE === undefined ? 0 : 1)",
        ],
        command: process.execPath,
        name: "without environment",
      },
    ]);
    expect(outcome.code).toBe(0);
  });

  it("reports the failed step and its fix command", () => {
    const outcome = runVerification(repositoryRoot, [
      {
        args: ["-e", "process.exit(3)"],
        command: process.execPath,
        fix: "pnpm mend",
        name: "boom",
      },
    ]);

    expect(outcome).toEqual({ code: 3, failedStep: "boom", fix: "pnpm mend" });
  });

  it("reports success without a fix command", () => {
    const outcome = runVerification(repositoryRoot, [
      {
        args: ["-e", "process.exit(0)"],
        command: process.execPath,
        name: "fine",
      },
    ]);

    expect(outcome).toEqual({ code: 0, failedStep: undefined, fix: undefined });
  });
});

describe("verification lanes", () => {
  const prerequisites = ["db:validate", "db:generate"];

  it.each(["success", "failure", "cancelled", "skipped"])(
    "accepts the aggregate result only when every job succeeds (%s)",
    (result) => {
      const workflow = readFileSync(
        path.join(repositoryRoot, ".github/workflows/ci.yml"),
        "utf8",
      );
      const aggregate = workflow.split("\n  verify:\n")[1];
      expect(aggregate).toContain("needs: [lanes, web]");
      expect(aggregate).toContain("if: ${{ always() }}");
      const command = aggregate?.split("run: |\n")[1];
      if (command === undefined) throw new Error("Missing aggregate check");
      for (const failedJob of ["LANES_RESULT", "WEB_RESULT"]) {
        const outcome = spawnSync("sh", ["-c", command], {
          encoding: "utf8",
          env: {
            ...process.env,
            LANES_RESULT: "success",
            WEB_RESULT: "success",
            [failedJob]: result,
          },
        });
        expect(outcome.status).toBe(result === "success" ? 0 : 1);
      }
    },
  );

  it("schedules every defined lane in CI", () => {
    const workflow = readFileSync(
      path.join(repositoryRoot, ".github/workflows/ci.yml"),
      "utf8",
    );
    const matrix = /lane: \[([^\]]+)\]/.exec(workflow)?.[1];
    const matrixLanes = matrix?.split(",").map((lane) => lane.trim()) ?? [];
    const dedicatedLanes = [
      ...workflow.matchAll(/run: pnpm verify --lane (\w+)/g),
    ].map((match) => match[1]);
    expect([...matrixLanes, ...dedicatedLanes].sort()).toEqual(
      [...verificationLanes].sort(),
    );
  });

  it("partitions every mandatory check exactly once except shared prerequisites", () => {
    const partition = verificationLanes.flatMap((lane) =>
      selectVerificationLane(lane).map((step) => step.name),
    );
    expect([...new Set(partition)].sort()).toEqual(
      verificationSteps.map((step) => step.name).sort(),
    );
    for (const step of verificationSteps) {
      expect(partition.filter((name) => name === step.name)).toHaveLength(
        prerequisites.includes(step.name) ? verificationLanes.length : 1,
      );
    }
  });

  it.each(verificationLanes)(
    "%s validates and generates its own client first",
    (lane) => {
      const names = selectVerificationLane(lane).map((step) => step.name);
      const generate = names.indexOf("db:generate");
      expect(generate).toBeGreaterThan(names.indexOf("db:validate"));
      for (const name of [
        "knip",
        "lint",
        "typecheck",
        "test:unit",
        "test:integration",
        "build:web",
        "build:native",
      ]) {
        if (names.includes(name)) {
          expect(generate).toBeLessThan(names.indexOf(name));
        }
      }
    },
  );

  it("builds and migrates web before the browser and keeps native separate", () => {
    expect(requireStep("test:e2e").env).toEqual({ E2E_USE_BUILD: "true" });
    expect(selectVerificationLane("web").map((step) => step.name)).toEqual([
      ...prerequisites,
      "build:web",
      "db:migrate",
      "test:e2e",
    ]);
    expect(selectVerificationLane("native").map((step) => step.name)).toEqual([
      ...prerequisites,
      "build:native",
      "test:e2e:mobile",
    ]);
  });

  it("rejects an unknown lane rather than silently verifying nothing", () => {
    expect(() => selectVerificationLane("typo")).toThrow(
      /Unknown verification lane/,
    );
  });
});

describe("verify CLI", () => {
  it.each([["--lane", "typo"], ["--lane"], ["--unknown"], ["units"]])(
    "rejects invalid arguments %j before running checks",
    (...args) => {
      const result = spawnSync(
        process.execPath,
        [
          path.join(repositoryRoot, "packages/tooling/src/bin/verify.ts"),
          ...args,
        ],
        { encoding: "utf8" },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/lane|argument|option/i);
      expect(result.stdout).not.toContain("verify [");
    },
  );
});
