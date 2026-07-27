import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { repositoryRoot } from "./repository.ts";
import {
  requireStep,
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
