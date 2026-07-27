import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { type PolicyViolation } from "./policy-violation.ts";
import { repositoryRoot } from "./repository.ts";
import { checkWorkflowPolicy } from "./workflow-policy.ts";

/**
 * The repository-host half of `pnpm policy`, proven the way stage 01
 * established: start from a checkout that satisfies every rule, break exactly
 * one thing, and assert the check names the file and states the edit. One test
 * proves the live repository still passes.
 */

const pinnedCheckout =
  "actions/checkout@1111111111111111111111111111111111111111 # v6.1.0";

function workflow(body: string): string {
  return body.replace(/^\n/, "");
}

const ciWorkflow = workflow(`
name: CI

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

permissions: {}

jobs:
  verify:
    name: Verify
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: Check out repository
        uses: ${pinnedCheckout}
      - name: Verify
        run: pnpm verify
`);

/** The line the pinned `uses:` sits on, so a failure can name it. */
const checkoutLine = 19;

const supplyChainWorkflow = workflow(`
name: Supply chain

on:
  push:
    branches: [main]
  pull_request:

permissions: {}

jobs:
  workflows:
    name: Workflows
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: Check out repository
        uses: ${pinnedCheckout}
      - name: Install actionlint
        run: |
          curl -o tool.tar.gz https://github.com/rhysd/actionlint/releases/download/v1.7.12/tool.tar.gz
          echo "abc  tool.tar.gz" | sha256sum --check --strict
`);

type RuleFixture = {
  type: string;
  parameters?: Record<string, unknown>;
};

type RulesetFixture = {
  description: string;
  requiresAdvancedSecurity: {
    reason: string;
    requiredStatusChecks: string[];
  };
  ruleset: {
    bypass_actors: unknown[];
    conditions: { ref_name: { exclude: string[]; include: string[] } };
    enforcement: string;
    name: string;
    rules: RuleFixture[];
    target: string;
  };
};

const ruleset: RulesetFixture = {
  description: "Branch protection.",
  requiresAdvancedSecurity: {
    reason: "Needs GitHub Advanced Security.",
    requiredStatusChecks: [],
  },
  ruleset: {
    bypass_actors: [],
    conditions: { ref_name: { exclude: [], include: ["~DEFAULT_BRANCH"] } },
    enforcement: "active",
    name: "main",
    rules: [
      { type: "deletion" },
      { type: "non_fast_forward" },
      { type: "required_linear_history" },
      {
        parameters: {
          allowed_merge_methods: ["squash", "rebase"],
          dismiss_stale_reviews_on_push: true,
          require_code_owner_review: true,
          require_last_push_approval: true,
          required_approving_review_count: 1,
          required_review_thread_resolution: true,
        },
        type: "pull_request",
      },
      {
        parameters: {
          do_not_enforce_on_create: false,
          required_status_checks: [
            { context: "Verify" },
            { context: "Workflows" },
          ],
          strict_required_status_checks_policy: true,
        },
        type: "required_status_checks",
      },
    ],
    target: "branch",
  },
};

const workspaceYaml = [
  "packages:",
  "  - packages/*",
  "",
  "onlyBuiltDependencies:",
  "  - prisma",
  "",
  "minimumReleaseAge: 1440",
  "",
].join("\n");

/** A minimal checkout that satisfies every rule, so a test can break one thing. */
function baseFiles(): Record<string, string> {
  return {
    ".github/CODEOWNERS": [
      "/AGENTS.md            @owner",
      "/.github/             @owner",
      "/packages/tooling/    @owner",
      "",
    ].join("\n"),
    ".github/rulesets/main.json": JSON.stringify(ruleset, null, 2),
    ".github/workflows/ci.yml": ciWorkflow,
    ".github/workflows/supply-chain.yml": supplyChainWorkflow,
    "package.json": JSON.stringify({ name: "ai-starter" }),
    "pnpm-workspace.yaml": workspaceYaml,
  };
}

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

/** Writes a checkout to a temporary directory and returns its violations. */
function check(files: Record<string, string>): PolicyViolation[] {
  const root = mkdtempSync(path.join(tmpdir(), "workflow-policy-"));
  roots.push(root);

  for (const [file, content] of Object.entries(files)) {
    const absolute = path.join(root, file);
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, content);
  }

  return checkWorkflowPolicy(root);
}

function withFile(file: string, content: string): Record<string, string> {
  return { ...baseFiles(), [file]: content };
}

function withRuleset(
  edit: (draft: RulesetFixture) => void,
): Record<string, string> {
  const draft = structuredClone(ruleset);
  edit(draft);
  return withFile(".github/rulesets/main.json", JSON.stringify(draft, null, 2));
}

function ruleOfType(draft: RulesetFixture, type: string): RuleFixture {
  const rule = draft.ruleset.rules.find((entry) => entry.type === type);
  if (rule?.parameters === undefined) {
    throw new Error(`The fixture has no parameterised ${type} rule.`);
  }
  return rule;
}

function problems(violations: readonly PolicyViolation[]): string {
  return violations.map((violation) => violation.problem).join("\n");
}

describe("workflow policy", () => {
  it("accepts a checkout that satisfies every rule", () => {
    expect(check(baseFiles())).toEqual([]);
  });

  it("accepts this repository", () => {
    expect(checkWorkflowPolicy(repositoryRoot)).toEqual([]);
  });

  describe("action pinning", () => {
    it("rejects an action referenced by a moving tag", () => {
      const violations = check(
        withFile(
          ".github/workflows/ci.yml",
          ciWorkflow.replace(pinnedCheckout, "actions/checkout@v6"),
        ),
      );

      expect(violations).toHaveLength(1);
      expect(violations[0]?.file).toBe(
        `.github/workflows/ci.yml:${String(checkoutLine)}`,
      );
      expect(problems(violations)).toContain("actions/checkout@v6");
      expect(violations[0]?.fix).toContain("commit SHA");
    });

    it("rejects a commit SHA with no version comment", () => {
      const violations = check(
        withFile(
          ".github/workflows/ci.yml",
          ciWorkflow.replace(
            pinnedCheckout,
            pinnedCheckout.replace(" # v6.1.0", ""),
          ),
        ),
      );

      expect(problems(violations)).toContain("no comment naming the version");
    });

    it("accepts a local action and a digest-pinned container action", () => {
      const digest = `docker://example/tool@sha256:${"a".repeat(64)}`;
      const violations = check(
        withFile(
          ".github/workflows/ci.yml",
          `${ciWorkflow.replace(
            `uses: ${pinnedCheckout}`,
            "uses: ./.github/actions/setup",
          )}      - name: Container\n        uses: ${digest}\n`,
        ),
      );

      expect(violations).toEqual([]);
    });
  });

  describe("scheduled sensors", () => {
    const sensor = (reporting: string): string =>
      workflow(`
name: Sensors

on:
  schedule:
    - cron: "0 4 * * *"
  workflow_dispatch:

permissions: {}

jobs:
  sense:
    name: Sense
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: Check out repository
        uses: ${pinnedCheckout}
      - name: Sense
        run: pnpm sense
${reporting}`);

    const reportingJob = `  report:
    name: Report a scheduled failure
    if: \${{ failure() }}
    needs: sense
    runs-on: ubuntu-latest
    permissions:
      issues: write
    steps:
      - name: Check out repository
        uses: ${pinnedCheckout}
      - name: File or update the issue
        uses: ./.github/actions/report-failure
        with:
          label: sensor:sense
          title: The sensor is failing
          summary: It failed.
          token: \${{ github.token }}
`;

    it("rejects a scheduled workflow whose red lands only in the Actions tab", () => {
      const violations = check(
        withFile(".github/workflows/sensors.yml", sensor("")),
      );

      expect(violations).toHaveLength(1);
      expect(violations[0]?.file).toBe(".github/workflows/sensors.yml");
      expect(problems(violations)).toContain("files nothing when it fails");
      expect(violations[0]?.fix).toContain("./.github/actions/report-failure");
    });

    it("accepts one that files an issue instead", () => {
      expect(
        check(withFile(".github/workflows/sensors.yml", sensor(reportingJob))),
      ).toEqual([]);
    });

    // The rule is about `schedule`, not about workflows in general: CI runs on
    // every pull request, where a failure is already in front of somebody.
    it("asks nothing of a workflow that does not run on a schedule", () => {
      expect(check(baseFiles())).toEqual([]);
    });
  });

  describe("workflow permissions", () => {
    it("rejects a workflow with no top-level permissions block", () => {
      const violations = check(
        withFile(
          ".github/workflows/ci.yml",
          ciWorkflow.replace("permissions: {}\n\n", ""),
        ),
      );

      expect(problems(violations)).toContain(
        "declares no top-level permissions",
      );
    });

    it("rejects a write-all grant", () => {
      const violations = check(
        withFile(
          ".github/workflows/ci.yml",
          ciWorkflow.replace("permissions: {}", "permissions: write-all"),
        ),
      );

      expect(problems(violations)).toContain("write-all");
    });

    it("rejects the pull_request_target trigger", () => {
      const violations = check(
        withFile(
          ".github/workflows/ci.yml",
          ciWorkflow.replace("  pull_request:\n", "  pull_request_target:\n"),
        ),
      );

      expect(problems(violations)).toContain("pull_request_target");
    });
  });

  describe("unverified downloads", () => {
    it("rejects a release download with no checksum check in the same job", () => {
      const violations = check(
        withFile(
          ".github/workflows/supply-chain.yml",
          supplyChainWorkflow.replace(
            '          echo "abc  tool.tar.gz" | sha256sum --check --strict\n',
            "",
          ),
        ),
      );

      expect(problems(violations)).toContain("without verifying a checksum");
    });
  });

  describe("required status checks", () => {
    it("rejects a required check that no job reports", () => {
      const violations = check(
        withRuleset((draft) => {
          ruleOfType(draft, "required_status_checks").parameters = {
            do_not_enforce_on_create: false,
            required_status_checks: [
              { context: "Verify" },
              { context: "Typo" },
            ],
            strict_required_status_checks_policy: true,
          };
        }),
      );

      expect(problems(violations)).toContain('"Typo"');
      expect(violations[0]?.fix).toContain("job");
    });

    it("rejects a required check whose workflow never runs on a pull request", () => {
      const violations = check(
        withFile(
          ".github/workflows/ci.yml",
          ciWorkflow.replace("  pull_request:\n", ""),
        ),
      );

      expect(problems(violations)).toContain("never runs on a pull request");
    });

    it("rejects a required check behind a paths filter", () => {
      const violations = check(
        withFile(
          ".github/workflows/ci.yml",
          ciWorkflow.replace(
            "  pull_request:\n",
            "  pull_request:\n    paths:\n      - apps/**\n",
          ),
        ),
      );

      expect(problems(violations)).toContain("paths filter");
    });

    it("checks the advanced-security list the same way", () => {
      const violations = check(
        withRuleset((draft) => {
          draft.requiresAdvancedSecurity.requiredStatusChecks = ["Nowhere"];
        }),
      );

      expect(problems(violations)).toContain('"Nowhere"');
    });
  });

  describe("ruleset payload", () => {
    it("rejects a pull_request rule missing a parameter the API requires", () => {
      const violations = check(
        withRuleset((draft) => {
          const parameters = ruleOfType(draft, "pull_request").parameters ?? {};
          delete parameters.require_code_owner_review;
        }),
      );

      expect(problems(violations)).toContain("require_code_owner_review");
    });

    it("rejects a rule the branch ruleset needs being dropped", () => {
      const violations = check(
        withRuleset((draft) => {
          draft.ruleset.rules = draft.ruleset.rules.filter(
            (rule) => rule.type !== "non_fast_forward",
          );
        }),
      );

      expect(problems(violations)).toContain("non_fast_forward");
    });

    it("rejects a bypass actor checked into the ruleset", () => {
      const violations = check(
        withRuleset((draft) => {
          draft.ruleset.bypass_actors = [
            {
              actor_id: 5,
              actor_type: "RepositoryRole",
              bypass_mode: "always",
            },
          ];
        }),
      );

      expect(problems(violations)).toContain("bypass");
    });
  });

  describe("pnpm supply-chain settings", () => {
    it("rejects a second lifecycle-script allowlist in the root manifest", () => {
      const violations = check(
        withFile(
          "package.json",
          JSON.stringify({
            name: "ai-starter",
            pnpm: { onlyBuiltDependencies: ["@sentry/cli"] },
          }),
        ),
      );

      expect(problems(violations)).toContain("onlyBuiltDependencies");
      expect(violations[0]?.file).toBe("package.json");
    });

    it("rejects a missing release-age floor", () => {
      const violations = check(
        withFile(
          "pnpm-workspace.yaml",
          workspaceYaml.replace("minimumReleaseAge: 1440\n", ""),
        ),
      );

      expect(problems(violations)).toContain("minimumReleaseAge");
    });

    it("rejects disabling the allowlist entirely", () => {
      const violations = check(
        withFile(
          "pnpm-workspace.yaml",
          `${workspaceYaml}dangerouslyAllowAllBuilds: true\n`,
        ),
      );

      expect(problems(violations)).toContain("dangerouslyAllowAllBuilds");
    });
  });

  describe("code owners", () => {
    it("rejects a harness path no owner reviews", () => {
      const violations = check(
        withFile(
          ".github/CODEOWNERS",
          "/AGENTS.md            @owner\n/.github/             @owner\n",
        ),
      );

      expect(problems(violations)).toContain("packages/tooling");
    });
  });
});
