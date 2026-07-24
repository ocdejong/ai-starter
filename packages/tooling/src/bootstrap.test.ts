import { describe, expect, it } from "vitest";

import { BootstrapError, publishedPortConflict } from "./bootstrap.ts";
import { type PostgresContainer } from "./container-runtime.ts";

const container: PostgresContainer = {
  database: "ai-starter",
  image: "docker.io/postgres:17-alpine",
  name: "ai-starter-postgres-5434",
  password: "password",
  port: 5434,
  user: "postgres",
};

describe("publishedPortConflict", () => {
  it("names both ports and the exact fix when the container publishes another port", () => {
    const conflict = publishedPortConflict("docker", container, 5436);

    expect(conflict).toBeInstanceOf(BootstrapError);
    expect(conflict?.message).toContain("5436");
    expect(conflict?.message).toContain("5434");
    expect(conflict?.message).toContain('"ai-starter-postgres-5434"');
    expect(conflict?.fix).toContain(
      "docker rm --force ai-starter-postgres-5434",
    );
    expect(conflict?.fix).toContain("apps/web/.env");
  });

  it("accepts a container publishing the configured port", () => {
    expect(publishedPortConflict("docker", container, 5434)).toBeUndefined();
  });

  it("accepts a container whose published port cannot be read", () => {
    expect(
      publishedPortConflict("docker", container, undefined),
    ).toBeUndefined();
  });
});
