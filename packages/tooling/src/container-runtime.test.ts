import { describe, expect, it } from "vitest";

import { postgresContainerName } from "./container-runtime.ts";

describe("postgresContainerName", () => {
  it("embeds the host port alongside the database name", () => {
    expect(postgresContainerName("ai-starter", 5433)).toBe(
      "ai-starter-postgres-5433",
    );
  });

  it("gives worktrees with different ports different containers for the same database", () => {
    expect(postgresContainerName("ai-starter", 5434)).not.toBe(
      postgresContainerName("ai-starter", 5435),
    );
  });

  it("produces a name the container runtimes accept", () => {
    expect(postgresContainerName("ai-starter", 5433)).toMatch(
      /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/,
    );
  });
});
