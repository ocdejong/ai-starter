import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vite-plus/test";

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

  function writeEnv(root: string, content: string): void {
    writeFileSync(path.join(root, "apps", "web", ".env"), content);
  }

  it("re-points a worktree left on the shared example origin at its own", async () => {
    // What a worktree bootstrapped before the derivation existed looks like:
    // a complete .env still naming the origin every sibling also names.
    const root = checkout("worktree");
    writeEnv(root, exampleEnv);

    await ensureWebEnvironment(root);

    expect(writtenEnv(root).get("BETTER_AUTH_URL")).toBe(
      `http://localhost:${13000 + worktreePortOffset(root)}`,
    );
  });

  it("moves a worktree whose .env names the example's database onto its own", async () => {
    // A .env copied from the primary checkout for its secrets: the database it
    // names is the one the primary checkout and every such sibling migrate.
    const root = checkout("worktree");
    writeEnv(root, exampleEnv);

    const databaseUrl = await ensureWebEnvironment(root);

    expect(parseDatabaseUrl(databaseUrl).port).toBe(
      15433 + worktreePortOffset(root),
    );
    expect(writtenEnv(root).get("DATABASE_URL")).toBe(databaseUrl);
  });

  function envWithPorts(webPort: number, databasePort: number): string {
    return exampleEnv
      .replace("localhost:13000", `localhost:${String(webPort)}`)
      .replace("localhost:15433", `localhost:${String(databasePort)}`);
  }

  it("moves a worktree whose .env was copied from a sibling onto its own values", async () => {
    // What copying a sibling's file for its secrets produces: the sibling's
    // own derived origin and database, named by two checkouts at once.
    const root = checkout("worktree");
    const offset = worktreePortOffset(root);
    const theirs = ((offset + 99) % 200) + 1;
    const copied = envWithPorts(13000 + theirs, 15433 + theirs);
    const sibling = checkout("worktree");
    writeEnv(sibling, copied);
    writeEnv(root, copied);

    const databaseUrl = await ensureWebEnvironment(root, [sibling]);

    expect(writtenEnv(root).get("BETTER_AUTH_URL")).toBe(
      `http://localhost:${String(13000 + offset)}`,
    );
    expect(parseDatabaseUrl(databaseUrl).port).toBe(15433 + offset);
  });

  it("steps past an offset a sibling already holds, so a hash collision resolves", async () => {
    const root = checkout("worktree");
    const offset = worktreePortOffset(root);
    // A sibling whose path hashed to the same offset and bootstrapped first.
    const sibling = checkout("worktree");
    writeEnv(sibling, envWithPorts(13000 + offset, 15433 + offset));

    const databaseUrl = await ensureWebEnvironment(root, [sibling]);

    const next = (offset % 200) + 1;
    expect(writtenEnv(root).get("BETTER_AUTH_URL")).toBe(
      `http://localhost:${String(13000 + next)}`,
    );
    expect(parseDatabaseUrl(databaseUrl).port).toBe(15433 + next);
  });

  it("leaves the other copy where it is once one of two has moved", async () => {
    const first = checkout("worktree");
    const second = checkout("worktree");
    const copied = envWithPorts(13187, 15620);
    writeEnv(first, copied);
    writeEnv(second, copied);

    await ensureWebEnvironment(first, [second]);
    await ensureWebEnvironment(second, [first]);

    expect(writtenEnv(second).get("BETTER_AUTH_URL")).toBe(
      "http://localhost:13187",
    );
    expect(writtenEnv(second).get("DATABASE_URL")).toContain("localhost:15620");
    expect(writtenEnv(first).get("BETTER_AUTH_URL")).not.toBe(
      "http://localhost:13187",
    );
  });

  it("leaves a primary checkout alone even when a worktree copied its .env", async () => {
    const root = checkout("primary");
    writeEnv(root, exampleEnv);
    const worktree = checkout("worktree");
    writeEnv(worktree, exampleEnv);

    const databaseUrl = await ensureWebEnvironment(root, [worktree]);

    expect(parseDatabaseUrl(databaseUrl).port).toBe(15433);
    expect(writtenEnv(root).get("BETTER_AUTH_URL")).toBe(
      "http://localhost:13000",
    );
  });

  it("keeps a database the developer pointed elsewhere", async () => {
    const root = checkout("worktree");
    writeEnv(root, exampleEnv.replace("localhost:15433", "localhost:15499"));

    const databaseUrl = await ensureWebEnvironment(root);

    expect(parseDatabaseUrl(databaseUrl).port).toBe(15499);
  });

  it("leaves a primary checkout on the example's database", async () => {
    const root = checkout("primary");
    writeEnv(root, exampleEnv);

    const databaseUrl = await ensureWebEnvironment(root);

    expect(parseDatabaseUrl(databaseUrl).port).toBe(15433);
  });

  it("keeps a web origin the developer chose", async () => {
    const root = checkout("worktree");
    writeEnv(
      root,
      exampleEnv.replace("http://localhost:13000", "http://localhost:13210"),
    );

    await ensureWebEnvironment(root);

    expect(writtenEnv(root).get("BETTER_AUTH_URL")).toBe(
      "http://localhost:13210",
    );
  });

  it("leaves a primary checkout on the example origin", async () => {
    const root = checkout("primary");
    writeEnv(root, exampleEnv);

    await ensureWebEnvironment(root);

    expect(writtenEnv(root).get("BETTER_AUTH_URL")).toBe(
      "http://localhost:13000",
    );
  });
});
