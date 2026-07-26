import { createServer, type Server } from "node:http";
import { type AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

import {
  applyRepositoryHost,
  createGitHubClient,
  type RecordedRequest,
} from "./repository-host-apply.ts";
import {
  readRulesetDefinitions,
  type RulesetDefinition,
} from "./repository-host.ts";
import { repositoryRoot } from "./repository.ts";

/**
 * The command is proven against a GitHub-shaped server rather than a mock, so
 * the assertions are about requests that actually crossed a socket: the method,
 * the path and the body. Three states matter — nothing there, already correct,
 * and drifted — because "idempotent" and "idempotent while nothing changes" are
 * different claims and only the third case tells them apart.
 *
 * What this cannot prove is that GitHub accepts the payload: this account's
 * plan refuses the ruleset API on a private repository, so the shape is checked
 * against the published REST schema by `pnpm policy` instead, and the round trip
 * is an honest gap.
 */

const repository = "owner/name";

type Route = (body: unknown) => {
  status: number;
  body?: unknown;
};

type Recorded = RecordedRequest & { readonly received: unknown };

class FakeGitHub {
  readonly received: Recorded[] = [];
  private readonly routes = new Map<string, Route>();
  private server: Server | undefined;
  private origin = "";

  route(method: string, path: string, handler: Route): this {
    this.routes.set(`${method} ${path}`, handler);
    return this;
  }

  async start(): Promise<string> {
    const server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        const parsed: unknown = raw.length > 0 ? JSON.parse(raw) : null;
        const method = request.method ?? "GET";
        const path = request.url ?? "";

        this.received.push({ body: parsed, method, path, received: parsed });

        const handler = this.routes.get(`${method} ${path}`);
        const result = handler?.(parsed) ?? {
          body: { message: `No route for ${method} ${path}` },
          status: 404,
        };

        response.writeHead(result.status, {
          "content-type": "application/json",
        });
        response.end(
          result.body === undefined ? "" : JSON.stringify(result.body),
        );
      });
    });

    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address() as AddressInfo;
    this.server = server;
    this.origin = `http://127.0.0.1:${String(address.port)}`;
    return this.origin;
  }

  async stop(): Promise<void> {
    const server = this.server;
    if (server !== undefined) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }

  writes(): Recorded[] {
    return this.received.filter((entry) => entry.method !== "GET");
  }

  url(): string {
    return this.origin;
  }
}

const definition: RulesetDefinition = {
  advancedSecurityChecks: ["Analyze"],
  file: ".github/rulesets/main.json",
  name: "main",
  payload: {
    bypass_actors: [],
    conditions: { ref_name: { exclude: [], include: ["~DEFAULT_BRANCH"] } },
    enforcement: "active",
    name: "main",
    rules: [
      { type: "deletion" },
      {
        parameters: {
          required_status_checks: [{ context: "Verify" }],
          strict_required_status_checks_policy: true,
        },
        type: "required_status_checks",
      },
    ],
    target: "branch",
  },
};

/** A repository that already satisfies everything except the ruleset. */
function settledRepository(): Record<string, unknown> {
  return {
    allow_merge_commit: false,
    allow_rebase_merge: true,
    allow_squash_merge: true,
    delete_branch_on_merge: true,
    security_and_analysis: {
      secret_scanning: { status: "enabled" },
      secret_scanning_push_protection: { status: "enabled" },
    },
  };
}

function baseRoutes(github: FakeGitHub, repositoryBody: unknown): FakeGitHub {
  return github
    .route("GET", `/repos/${repository}`, () => ({
      body: repositoryBody,
      status: 200,
    }))
    .route("GET", `/repos/${repository}/vulnerability-alerts`, () => ({
      status: 204,
    }))
    .route("GET", `/repos/${repository}/automated-security-fixes`, () => ({
      body: { enabled: true },
      status: 200,
    }))
    .route(
      "GET",
      `/repos/${repository}/private-vulnerability-reporting`,
      () => ({
        body: { enabled: true },
        status: 200,
      }),
    );
}

const servers: FakeGitHub[] = [];

afterEach(async () => {
  for (const server of servers.splice(0)) {
    await server.stop();
  }
});

async function run(
  github: FakeGitHub,
  overrides: { codeScanning?: boolean; dryRun?: boolean } = {},
): Promise<ReturnType<typeof applyRepositoryHost>> {
  servers.push(github);
  const baseUrl = await github.start();

  return applyRepositoryHost({
    bypassActor: undefined,
    client: createGitHubClient({ baseUrl, token: "test-token" }),
    codeScanning: overrides.codeScanning ?? false,
    definitions: [definition],
    dryRun: overrides.dryRun ?? false,
    repository,
  });
}

describe("applying the repository host", () => {
  it("creates the ruleset when the repository has none", async () => {
    const github = baseRoutes(new FakeGitHub(), settledRepository())
      .route("GET", `/repos/${repository}/rulesets`, () => ({
        body: [],
        status: 200,
      }))
      .route("POST", `/repos/${repository}/rulesets`, () => ({
        body: { id: 7, name: "main" },
        status: 201,
      }));

    const report = await run(github);

    expect(github.writes()).toHaveLength(1);
    expect(github.writes()[0]?.method).toBe("POST");
    expect(github.writes()[0]?.path).toBe(`/repos/${repository}/rulesets`);
    expect(github.writes()[0]?.received).toEqual(definition.payload);
    expect(report.steps.filter((step) => step.outcome === "failed")).toEqual(
      [],
    );
  });

  it("issues no writes at all when the host already matches the checkout", async () => {
    const github = baseRoutes(new FakeGitHub(), settledRepository())
      .route("GET", `/repos/${repository}/rulesets`, () => ({
        body: [{ id: 7, name: "main" }],
        status: 200,
      }))
      .route("GET", `/repos/${repository}/rulesets/7`, () => ({
        // GitHub answers with fields no checkout can predict; they are not drift.
        body: {
          ...definition.payload,
          _links: { self: { href: "https://example.invalid" } },
          created_at: "2026-01-01T00:00:00Z",
          id: 7,
          node_id: "RRS_1",
          source: repository,
          source_type: "Repository",
        },
        status: 200,
      }));

    const report = await run(github);

    expect(github.writes()).toEqual([]);
    expect(report.planned).toEqual([]);
    expect(report.steps.every((step) => step.outcome === "unchanged")).toBe(
      true,
    );
  });

  it("updates the existing ruleset in place when it has drifted", async () => {
    const github = baseRoutes(new FakeGitHub(), settledRepository())
      .route("GET", `/repos/${repository}/rulesets`, () => ({
        body: [{ id: 7, name: "main" }],
        status: 200,
      }))
      .route("GET", `/repos/${repository}/rulesets/7`, () => ({
        body: {
          ...definition.payload,
          id: 7,
          rules: [{ type: "deletion" }],
        },
        status: 200,
      }))
      .route("PUT", `/repos/${repository}/rulesets/7`, () => ({
        body: { id: 7, name: "main" },
        status: 200,
      }));

    const report = await run(github);

    expect(github.writes()).toHaveLength(1);
    expect(github.writes()[0]?.method).toBe("PUT");
    expect(github.writes()[0]?.path).toBe(`/repos/${repository}/rulesets/7`);
    expect(
      report.steps.find((step) => step.name.startsWith("Ruleset")),
    ).toMatchObject({ outcome: "applied" });
  });

  it("turns on the settings a fresh repository leaves off", async () => {
    const github = new FakeGitHub()
      .route("GET", `/repos/${repository}`, () => ({
        body: { allow_merge_commit: true, delete_branch_on_merge: false },
        status: 200,
      }))
      .route("PATCH", `/repos/${repository}`, () => ({ body: {}, status: 200 }))
      .route("GET", `/repos/${repository}/vulnerability-alerts`, () => ({
        body: { message: "Not Found" },
        status: 404,
      }))
      .route("PUT", `/repos/${repository}/vulnerability-alerts`, () => ({
        status: 204,
      }))
      .route("GET", `/repos/${repository}/automated-security-fixes`, () => ({
        body: { enabled: false },
        status: 200,
      }))
      .route("PUT", `/repos/${repository}/automated-security-fixes`, () => ({
        status: 204,
      }))
      .route(
        "GET",
        `/repos/${repository}/private-vulnerability-reporting`,
        () => ({
          body: { enabled: false },
          status: 200,
        }),
      )
      .route(
        "PUT",
        `/repos/${repository}/private-vulnerability-reporting`,
        () => ({
          status: 204,
        }),
      )
      .route("GET", `/repos/${repository}/rulesets`, () => ({
        body: [],
        status: 200,
      }))
      .route("POST", `/repos/${repository}/rulesets`, () => ({
        body: { id: 1, name: "main" },
        status: 201,
      }));

    const report = await run(github);

    expect(
      github.writes().map((entry) => `${entry.method} ${entry.path}`),
    ).toEqual([
      `PATCH /repos/${repository}`,
      `PATCH /repos/${repository}`,
      `PUT /repos/${repository}/vulnerability-alerts`,
      `PUT /repos/${repository}/automated-security-fixes`,
      `PUT /repos/${repository}/private-vulnerability-reporting`,
      `POST /repos/${repository}/rulesets`,
    ]);
    expect(report.steps.some((step) => step.outcome === "failed")).toBe(false);
  });

  it("adds the code-scanning checks only when asked", async () => {
    const github = baseRoutes(new FakeGitHub(), settledRepository())
      .route("GET", `/repos/${repository}/rulesets`, () => ({
        body: [],
        status: 200,
      }))
      .route("POST", `/repos/${repository}/rulesets`, () => ({
        body: { id: 1 },
        status: 201,
      }));

    await run(github, { codeScanning: true });

    const sent = github.writes()[0]?.received;
    expect(JSON.stringify(sent)).toContain('{"context":"Analyze"}');
  });

  it("sends nothing under --dry-run but reports what it would send", async () => {
    const github = baseRoutes(new FakeGitHub(), settledRepository()).route(
      "GET",
      `/repos/${repository}/rulesets`,
      () => ({ body: [], status: 200 }),
    );

    const report = await run(github, { dryRun: true });

    expect(github.writes()).toEqual([]);
    expect(report.planned).toEqual([
      {
        body: definition.payload,
        method: "POST",
        path: `/repos/${repository}/rulesets`,
      },
    ]);
  });

  it("reports a plan refusal with the remediation instead of a stack trace", async () => {
    const github = baseRoutes(new FakeGitHub(), settledRepository()).route(
      "GET",
      `/repos/${repository}/rulesets`,
      () => ({
        body: {
          message:
            "Upgrade to GitHub Pro or make this repository public to enable this feature.",
        },
        status: 403,
      }),
    );

    const report = await run(github);
    const step = report.steps.find((entry) => entry.name === "Branch ruleset");

    expect(step?.outcome).toBe("failed");
    expect(step?.detail).toContain("make the repository public");
    expect(report.planned).toHaveLength(1);
  });

  it("applies this repository's own checked-in ruleset", async () => {
    const definitions = readRulesetDefinitions(repositoryRoot);
    const github = baseRoutes(new FakeGitHub(), settledRepository())
      .route("GET", `/repos/${repository}/rulesets`, () => ({
        body: [],
        status: 200,
      }))
      .route("POST", `/repos/${repository}/rulesets`, () => ({
        body: { id: 1 },
        status: 201,
      }));

    servers.push(github);
    const baseUrl = await github.start();

    const report = await applyRepositoryHost({
      bypassActor: undefined,
      client: createGitHubClient({ baseUrl, token: "test-token" }),
      codeScanning: false,
      definitions,
      dryRun: false,
      repository,
    });

    expect(report.steps.some((step) => step.outcome === "failed")).toBe(false);
    expect(github.writes()[0]?.received).toMatchObject({
      enforcement: "active",
      name: "main",
      target: "branch",
    });
  });
});
