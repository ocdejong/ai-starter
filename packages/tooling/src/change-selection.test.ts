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

  it("always checks formatting and the affected package graph", () => {
    expect(names(["packages/domain/src/post.ts"])).toEqual([
      "format:check",
      "affected lint, typecheck and unit tests",
      "test:e2e",
    ]);
  });

  it("passes the resolved base to the Turborepo filter", () => {
    const [, affected] = selectChecks(
      ["apps/mobile/src/app/index.tsx"],
      base,
    ).steps;

    expect(affected?.args).toContain(`--filter=...[${base}]`);
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
