import { describe, expect, it } from "vitest";

import { checkLocalDatabase, isLocalDatabaseHost } from "./local-database.ts";

describe("isLocalDatabaseHost", () => {
  it.each([
    "localhost",
    "db.localhost",
    "127.0.0.1",
    "127.5.6.7",
    "::1",
    "[::1]",
  ])("treats %s as local", (host) => {
    expect(isLocalDatabaseHost(host)).toBe(true);
  });

  it.each([
    "db.internal",
    "prod-db.rds.amazonaws.com",
    "10.0.0.5",
    "192.168.1.20",
    "example.com",
    "notlocalhost.com",
    "127.0.0.1.evil.com",
  ])("treats %s as remote", (host) => {
    expect(isLocalDatabaseHost(host)).toBe(false);
  });
});

describe("checkLocalDatabase", () => {
  it("allows a loopback database and reports the host", () => {
    expect(
      checkLocalDatabase("postgresql://postgres:pw@localhost:5434/ai-starter"),
    ).toEqual({ host: "localhost", local: true });
  });

  it("allows the container address CI uses", () => {
    expect(
      checkLocalDatabase(
        "postgresql://postgres:postgres@127.0.0.1:5432/starter_ci",
      ).local,
    ).toBe(true);
  });

  it("blocks a managed remote host and names it", () => {
    const verdict = checkLocalDatabase(
      "postgresql://user:pw@prod-db.rds.amazonaws.com:5432/app",
    );

    if (verdict.local) {
      throw new Error("expected a managed remote host to be rejected");
    }
    expect(verdict.reason).toContain("prod-db.rds.amazonaws.com");
  });

  it("fails closed when DATABASE_URL is unset", () => {
    expect(checkLocalDatabase(undefined)).toEqual({
      local: false,
      reason: "DATABASE_URL is not set, so the target cannot be proven local.",
    });
  });

  it("fails closed when DATABASE_URL is unparseable", () => {
    expect(checkLocalDatabase("not a url").local).toBe(false);
  });

  it("fails closed on a non-postgres protocol rather than assuming local", () => {
    expect(checkLocalDatabase("mysql://root@localhost/app").local).toBe(false);
  });
});
