import { describe, expect, it } from "vitest";

import { selectChecks } from "./change-selection.ts";
import { verificationSteps } from "./verification.ts";

const base = "abc1234";
const names = (paths: string[]): string[] =>
  selectChecks(paths, base).steps.map((step) => step.name);

describe("selectChecks", () => {
  it("selects nothing when nothing changed", () => {
    expect(selectChecks([], base).steps).toEqual([]);
  });

  it("always checks formatting, structure, the graph and the affected package graph", () => {
    expect(names(["packages/domain/src/post.ts"])).toEqual([
      "format:check",
      "policy",
      "arch",
      "affected lint, typecheck and unit tests",
      "test:e2e",
    ]);
  });

  it("passes the resolved base to the Turborepo filter", () => {
    const affected = selectChecks(
      ["apps/mobile/src/app/index.tsx"],
      base,
    ).steps.find(
      (step) => step.name === "affected lint, typecheck and unit tests",
    );

    expect(affected?.args).toContain(`--filter=...[${base}]`);
  });

  it.each([
    "AGENTS.md",
    "packages/tooling/AGENTS.md",
    "docs/architecture.md",
    "README.md",
    ".cursor/rules/repository.mdc",
    ".github/copilot-instructions.md",
  ])("rechecks the instruction policy when %s changes", (file) => {
    expect(names([file])).toContain("instructions");
  });

  it("does not recheck the instruction policy for an ordinary source change", () => {
    expect(names(["packages/domain/src/post.ts"])).not.toContain(
      "instructions",
    );
  });

  it("adds real-PostgreSQL evidence when the schema or a migration changes", () => {
    expect(names(["packages/db/prisma/schema.prisma"])).toContain(
      "test:integration",
    );
    expect(
      names([
        "packages/db/prisma/migrations/20260722113815_init/migration.sql",
      ]),
    ).toContain("test:integration");
  });

  it("runs the real-PostgreSQL tests when a database-backed flow package changes", () => {
    expect(names(["packages/auth/src/init-auth.ts"])).toContain(
      "test:integration",
    );
    // A persistence adapter's queries are proven only against real PostgreSQL,
    // and its source sits outside the schema directory.
    expect(names(["packages/db/src/group-repository.ts"])).toContain(
      "test:integration",
    );
  });

  it("regenerates the Prisma client before the affected typecheck when the schema changes", () => {
    const selected = names(["packages/db/prisma/schema.prisma"]);
    const affected = selected.indexOf(
      "affected lint, typecheck and unit tests",
    );

    expect(selected.indexOf("db:generate")).toBeGreaterThan(-1);
    expect(selected.indexOf("db:generate")).toBeLessThan(affected);
    expect(selected.indexOf("db:validate")).toBeLessThan(
      selected.indexOf("db:generate"),
    );
  });

  it("selects the integration suite only once when schema and auth both change", () => {
    const selected = names([
      "packages/db/prisma/schema.prisma",
      "packages/auth/src/init-auth.ts",
    ]).filter((name) => name === "test:integration");

    expect(selected).toHaveLength(1);
  });

  it("adds the browser journey for web-observable behaviour", () => {
    expect(names(["apps/web/src/app/page.tsx"])).toContain("test:e2e");
    expect(names(["packages/api/src/root.ts"])).toContain("test:e2e");
  });

  it("does not run the browser journey for native-only changes", () => {
    expect(names(["apps/mobile/src/app/index.tsx"])).not.toContain("test:e2e");
  });

  it.each([
    "turbo.json",
    "package.json",
    "pnpm-lock.yaml",
    "packages/config/eslint/rules.js",
    "packages/tooling/src/verification.ts",
    ".github/workflows/ci.yml",
  ])("falls back to the authoritative suite when %s changes", (file) => {
    expect(selectChecks([file], base).steps).toEqual(verificationSteps);
  });

  it("treats a workspace manifest as a package change, not a harness change", () => {
    expect(selectChecks(["apps/web/package.json"], base).steps).not.toEqual(
      verificationSteps,
    );
  });

  it("explains every selection", () => {
    expect(
      selectChecks(["packages/db/prisma/schema.prisma"], base).reasons.length,
    ).toBeGreaterThan(1);
  });
});
