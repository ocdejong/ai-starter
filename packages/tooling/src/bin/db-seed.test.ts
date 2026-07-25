import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const command = path.join(import.meta.dirname, "db-seed.ts");

/**
 * The block path is safe to exercise directly: a remote DATABASE_URL is
 * rejected before the seed is ever spawned, so no database is touched. The
 * allow path is proven by the seed's own integration test in packages/auth.
 */
describe("db:seed guard", () => {
  it("refuses a remote database and does not reach the seed", () => {
    const result = spawnSync(process.execPath, [command], {
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: "postgresql://user:pw@prod-db.rds.amazonaws.com:5432/app",
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("db:seed refused");
    expect(result.stderr).toContain("prod-db.rds.amazonaws.com");
    expect(result.stdout).not.toContain("demo user");
  });

  it("refuses when DATABASE_URL is absent", () => {
    const env = { ...process.env };
    delete env.DATABASE_URL;
    const result = spawnSync(process.execPath, [command], {
      encoding: "utf8",
      env,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("DATABASE_URL is not set");
  });
});
