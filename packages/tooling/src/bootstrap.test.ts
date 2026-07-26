import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  BootstrapError,
  ensureWebEnvironment,
  publishedPortConflict,
} from "./bootstrap.ts";
import { type PostgresContainer } from "./container-runtime.ts";
import { parseDatabaseUrl } from "./database-url.ts";
import { parseEnvFile } from "./env-file.ts";
import { worktreePortOffset } from "./worktree-ports.ts";

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

/**
 * The example ports sit far from the 5433/3000 the real example uses, so the
 * exact-port assertions cannot collide with containers or dev servers of the
 * actual checkouts on the machine running this suite.
 */
const exampleEnv = `BETTER_AUTH_SECRET=""
BETTER_AUTH_URL="http://localhost:13000"
DATABASE_URL="postgresql://postgres:password@localhost:15433/ai-starter"
`;

describe("ensureWebEnvironment", () => {
  let roots: string[] = [];

  afterEach(() => {
    for (const root of roots) {
      rmSync(root, { force: true, recursive: true });
    }
    roots = [];
  });

  function checkout(kind: "primary" | "worktree"): string {
    const root = mkdtempSync(path.join(tmpdir(), "bootstrap-env-"));
    roots.push(root);
    mkdirSync(path.join(root, "apps", "web"), { recursive: true });
    writeFileSync(path.join(root, "apps", "web", ".env.example"), exampleEnv);
    if (kind === "worktree") {
      writeFileSync(
        path.join(root, ".git"),
        "gitdir: /elsewhere/.git/worktrees/example\n",
      );
    } else {
      mkdirSync(path.join(root, ".git"));
    }
    return root;
  }

  function writtenEnv(root: string): Map<string, string> {
    return parseEnvFile(
      readFileSync(path.join(root, "apps", "web", ".env"), "utf8"),
    );
  }

  it("keeps the example ports for a primary checkout", async () => {
    const root = checkout("primary");

    const databaseUrl = await ensureWebEnvironment(root);

    expect(parseDatabaseUrl(databaseUrl).port).toBe(15433);
    expect(writtenEnv(root).get("BETTER_AUTH_URL")).toBe(
      "http://localhost:13000",
    );
  });

  it("derives worktree-specific database and web ports so sibling worktrees cannot share them", async () => {
    const root = checkout("worktree");
    const offset = worktreePortOffset(root);

    const databaseUrl = await ensureWebEnvironment(root);

    expect(parseDatabaseUrl(databaseUrl).port).toBe(15433 + offset);
    expect(writtenEnv(root).get("BETTER_AUTH_URL")).toBe(
      `http://localhost:${13000 + offset}`,
    );
  });

  it("derives the same ports again when the worktree's .env is recreated", async () => {
    const root = checkout("worktree");

    const first = await ensureWebEnvironment(root);
    rmSync(path.join(root, "apps", "web", ".env"));
    const second = await ensureWebEnvironment(root);

    expect(second).toBe(first);
  });
});
