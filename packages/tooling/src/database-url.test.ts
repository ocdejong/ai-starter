import { describe, expect, it } from "vitest";

import {
  DatabaseUrlError,
  parseDatabaseUrl,
  withPort,
} from "./database-url.ts";

describe("parseDatabaseUrl", () => {
  it("reads the connection details the container and diagnostics need", () => {
    expect(
      parseDatabaseUrl(
        "postgresql://postgres:secret@localhost:5433/example_db",
      ),
    ).toEqual({
      database: "example_db",
      host: "localhost",
      password: "secret",
      port: 5433,
      user: "postgres",
    });
  });

  it("defaults the port to the PostgreSQL default", () => {
    expect(parseDatabaseUrl("postgres://user:pw@db.internal/app").port).toBe(
      5432,
    );
  });

  it("decodes percent-encoded credentials", () => {
    expect(
      parseDatabaseUrl("postgresql://user:p%40ss@localhost:5432/app").password,
    ).toBe("p@ss");
  });

  it.each([
    ["not a URL", "definitely-not-a-url"],
    ["a non-PostgreSQL protocol", "mysql://user:pw@localhost:3306/app"],
    ["a URL without a database", "postgresql://user:pw@localhost:5432/"],
  ])("rejects %s", (_case, value) => {
    expect(() => parseDatabaseUrl(value)).toThrow(DatabaseUrlError);
  });
});

describe("withPort", () => {
  it("changes only the port", () => {
    const moved = withPort(
      "postgresql://postgres:secret@localhost:5433/example_db",
      5440,
    );

    expect(parseDatabaseUrl(moved)).toEqual({
      database: "example_db",
      host: "localhost",
      password: "secret",
      port: 5440,
      user: "postgres",
    });
  });
});
