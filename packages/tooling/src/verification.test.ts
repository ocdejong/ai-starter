import { describe, expect, it } from "vitest";

import { verificationSteps } from "./verification.ts";

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

  it("validates the schema before generating a client from it", () => {
    expect(position("db:validate")).toBeGreaterThan(-1);
    expect(position("db:validate")).toBeLessThan(position("db:generate"));
  });
});
