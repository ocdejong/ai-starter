import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const command = path.join(import.meta.dirname, "db-migration-new.ts");

function run(args: string[], databaseUrl: string | undefined) {
  const env = { ...process.env };
  delete env.DATABASE_URL;
  return spawnSync(process.execPath, [command, ...args], {
    encoding: "utf8",
    env:
      databaseUrl === undefined ? env : { ...env, DATABASE_URL: databaseUrl },
  });
}

/**
 * Every refusal here happens before Prisma is spawned, so no database is
 * touched. The path that does touch one is covered by `migration-new.test.ts`
 * with Prisma replaced, and the real command is exercised by hand.
 */
describe("db:migration:new guards", { timeout: 60_000 }, () => {
  it("refuses a remote database", () => {
    const result = run(
      ["add_invoice"],
      "postgresql://user:pw@prod-db.rds.amazonaws.com:5432/app",
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("db:migration:new refused");
    expect(result.stderr).toContain("prod-db.rds.amazonaws.com");
  });

  it("refuses when DATABASE_URL is absent", () => {
    const result = run(["add_invoice"], undefined);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("DATABASE_URL is not set");
  });

  it.each([[[]], [["a", "b"]], [["--unknown"]]])(
    "wants exactly one name: %j",
    (args) => {
      const result = run(args, "postgresql://postgres:pw@localhost:5432/app");

      expect(result.status).toBe(2);
      expect(result.stderr).toContain("Usage: pnpm db:migration:new");
    },
  );

  it("rejects an invalid name before reaching the database", () => {
    const result = run(
      ["Bad-Name"],
      "postgresql://postgres:pw@localhost:5432/app",
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("not a usable migration name");
  });
});
