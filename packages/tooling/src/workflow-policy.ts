import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { type PolicyViolation } from "./policy-violation.ts";
import { rulesetDirectory } from "./repository-host.ts";

/**
 * The rules that keep the repository host and the supply chain from being
 * loosened by an ordinary-looking edit: every action pinned to a commit, every
 * workflow starting from no permissions, every downloaded tool checksummed,
 * every branch-ruleset requirement backed by a check that can actually report,
 * and one lifecycle-script allowlist rather than two.
 *
 * These are line predicates, deliberately, not a YAML parser. `actionlint` in
 * `.github/workflows/supply-chain.yml` is what proves the files parse at all;
 * this module only has to recognise the shapes a reviewer would look for, and a
 * checker that cannot be fooled by valid-but-unusual YAML is worth less than one
 * that never blocks a change for the wrong reason.
 */

const workflowDirectory = ".github/workflows";
const codeownersPath = ".github/CODEOWNERS";
const workspaceManifest = "pnpm-workspace.yaml";
const rootManifest = "package.json";

/** Rules the branch ruleset must keep, and why dropping one matters. */
const requiredRuleTypes: Readonly<Record<string, string>> = {
  deletion: "the default branch could be deleted outright",
  non_fast_forward: "history could be rewritten by a force push",
  pull_request: "a commit could be pushed straight to the default branch",
  required_linear_history: "merge commits could hide an unreviewed parent",
  required_status_checks:
    "a pull request could merge without the suite passing",
};

/** Parameters the REST API rejects a `pull_request` rule for omitting. */
const requiredPullRequestParameters = [
  "dismiss_stale_reviews_on_push",
  "require_code_owner_review",
  "require_last_push_approval",
  "required_approving_review_count",
  "required_review_thread_resolution",
];

/** Paths whose edits decide what every other change is allowed to do. */
const harnessOwnedPaths = ["/AGENTS.md", "/.github/", "/packages/tooling/"];

/** pnpm settings that would re-open the lifecycle-script hole. */
const forbiddenPnpmSettings = [
  "dangerouslyAllowAllBuilds",
  "neverBuiltDependencies",
  "onlyBuiltDependenciesFile",
];

const commitShaPin = /^[0-9a-f]{40}$/;
const digestPin = /^docker:\/\/[^@\s]+@sha256:[0-9a-f]{64}$/;
const releaseDownload = /https?:\/\/\S*\/releases\/download\//;
const checksumVerification =
  /(sha256sum\s+(?:[^\n|]*\s)?(?:--check|-c)\b)|(shasum\s+[^\n|]*-c\b)|(gh\s+attestation\s+verify)/;

type Trigger = {
  readonly name: string;
  readonly hasPathFilter: boolean;
};

type Job = {
  readonly id: string;
  /** The check name GitHub reports: the job's `name`, or its id when unnamed. */
  readonly checkName: string;
  readonly lines: readonly string[];
};

type Workflow = {
  readonly file: string;
  readonly lines: readonly string[];
  readonly hasTopLevelPermissions: boolean;
  readonly triggers: readonly Trigger[];
  readonly jobs: readonly Job[];
};

function readText(root: string, file: string): string | undefined {
  const absolute = path.join(root, file);
  return existsSync(absolute) ? readFileSync(absolute, "utf8") : undefined;
}

function listYamlFiles(root: string, directory: string): string[] {
  const absolute = path.join(root, directory);
  if (!existsSync(absolute)) {
    return [];
  }
  return readdirSync(absolute)
    .filter((entry) => entry.endsWith(".yml") || entry.endsWith(".yaml"))
    .sort()
    .map((entry) => `${directory}/${entry}`);
}

/** Strips a `#` comment, respecting neither quotes nor escapes — see the note above. */
function withoutComment(line: string): string {
  const hash = line.indexOf("#");
  return hash === -1 ? line : line.slice(0, hash);
}

function parseWorkflow(file: string, text: string): Workflow {
  const lines = text.split("\n");
  const triggers: Trigger[] = [];
  const jobs: Job[] = [];

  let section = "";
  let currentTrigger: { name: string; hasPathFilter: boolean } | undefined;
  let currentJob:
    { id: string; checkName: string; lines: string[] } | undefined;
  let hasTopLevelPermissions = false;

  const closeTrigger = (): void => {
    if (currentTrigger !== undefined) {
      triggers.push({ ...currentTrigger });
      currentTrigger = undefined;
    }
  };
  const closeJob = (): void => {
    if (currentJob !== undefined) {
      jobs.push({ ...currentJob });
      currentJob = undefined;
    }
  };

  for (const line of lines) {
    const topLevel = /^(["']?)([A-Za-z_][\w-]*)\1\s*:(.*)$/.exec(line);
    if (topLevel !== null) {
      closeTrigger();
      closeJob();
      section = topLevel[2] ?? "";
      const inlineValue = (topLevel[3] ?? "").trim();

      if (section === "permissions") {
        hasTopLevelPermissions = true;
      }
      if (section === "on" && inlineValue.length > 0) {
        // `on: [push, pull_request]` and `on: push` carry no filters.
        for (const name of inlineValue.replace(/[[\]]/g, "").split(",")) {
          const trimmed = name.trim();
          if (trimmed.length > 0) {
            triggers.push({ hasPathFilter: false, name: trimmed });
          }
        }
      }
      continue;
    }

    const nested = /^ {2}(["']?)([A-Za-z_][\w-]*)\1\s*:/.exec(line);
    if (nested !== null) {
      const name = nested[2] ?? "";
      if (section === "on") {
        closeTrigger();
        currentTrigger = { hasPathFilter: false, name };
      } else if (section === "jobs") {
        closeJob();
        currentJob = { checkName: name, id: name, lines: [] };
      }
      continue;
    }

    if (section === "on" && currentTrigger !== undefined) {
      if (/^ {4}paths(-ignore)?\s*:/.test(line)) {
        currentTrigger = { ...currentTrigger, hasPathFilter: true };
      }
      continue;
    }

    if (section === "jobs" && currentJob !== undefined) {
      const jobName = /^ {4}name\s*:\s*(.+?)\s*$/.exec(line);
      if (jobName !== null) {
        const raw = jobName[1] ?? "";
        currentJob = {
          ...currentJob,
          checkName: raw.replace(/^["']|["']$/g, ""),
        };
      }
      currentJob.lines.push(line);
    }
  }

  closeTrigger();
  closeJob();

  return { file, hasTopLevelPermissions, jobs, lines, triggers };
}

function readWorkflows(root: string): Workflow[] {
  return listYamlFiles(root, workflowDirectory).map((file) =>
    parseWorkflow(file, readText(root, file) ?? ""),
  );
}

function checkActionPins(workflows: readonly Workflow[]): PolicyViolation[] {
  const violations: PolicyViolation[] = [];

  for (const workflow of workflows) {
    workflow.lines.forEach((line, index) => {
      const match = /^\s*(?:-\s+)?uses\s*:\s*(\S+)(.*)$/.exec(line);
      if (match === null) {
        return;
      }

      const reference = match[1] ?? "";
      const trailing = (match[2] ?? "").trim();
      const location = `${workflow.file}:${String(index + 1)}`;

      if (reference.startsWith("./") || digestPin.test(reference)) {
        return;
      }

      const pin = reference.split("@")[1] ?? "";
      if (!commitShaPin.test(pin)) {
        violations.push({
          file: location,
          fix: `Replace the reference with the commit SHA the tag points at, followed by \`# <version>\`: \`gh api repos/<owner>/<repo>/git/ref/tags/<tag>\`.`,
          problem: `${reference} is not pinned to a commit SHA, so the code it runs can change without a commit here.`,
        });
        return;
      }

      if (!trailing.startsWith("#") || trailing.replace(/^#\s*/, "") === "") {
        violations.push({
          file: location,
          fix: `Add \`# <version>\` after the SHA so a reader — and Dependabot — can tell which release is pinned.`,
          problem: `${reference} is pinned but carries no comment naming the version.`,
        });
      }
    });
  }

  return violations;
}

function checkWorkflowPermissions(
  workflows: readonly Workflow[],
): PolicyViolation[] {
  const violations: PolicyViolation[] = [];

  for (const workflow of workflows) {
    if (!workflow.hasTopLevelPermissions) {
      violations.push({
        file: workflow.file,
        fix: `Add \`permissions: {}\` above \`jobs:\` and grant each job only the scopes it needs.`,
        problem: `${workflow.file} declares no top-level permissions, so every job inherits the repository default.`,
      });
    }

    workflow.lines.forEach((line, index) => {
      if (/^\s*permissions\s*:\s*write-all\s*$/.test(withoutComment(line))) {
        violations.push({
          file: `${workflow.file}:${String(index + 1)}`,
          fix: `Replace write-all with the individual scopes the job uses.`,
          problem: `write-all grants every token scope, including \`contents: write\`.`,
        });
      }
    });

    const target = workflow.triggers.find(
      (trigger) => trigger.name === "pull_request_target",
    );
    if (target !== undefined) {
      violations.push({
        file: workflow.file,
        fix: `Use \`pull_request\` instead; a fork's pull request must not run with a writable token.`,
        problem: `pull_request_target runs untrusted code with the base repository's secrets.`,
      });
    }
  }

  return violations;
}

const failureReportAction = "./.github/actions/report-failure";

/**
 * A scheduled job's red appears in the Actions tab and nowhere else, which is
 * the same shape as the flow nobody ran: a signal exists, is never looked at,
 * and rots into a claim the repository cannot back. So every workflow that runs
 * on a schedule has to route its own failure somewhere a person will meet it.
 *
 * Checked as "somewhere in the file", not per job, deliberately. Where the
 * reporting job sits and what it is called are design choices; that a scheduled
 * sensor has a failure path at all is not.
 */
function checkScheduledSensorsReport(
  workflows: readonly Workflow[],
): PolicyViolation[] {
  return workflows
    .filter(
      (workflow) =>
        workflow.triggers.some((trigger) => trigger.name === "schedule") &&
        !workflow.lines.some((line) => line.includes(failureReportAction)),
    )
    .map((workflow) => ({
      file: workflow.file,
      fix: `Add a job with \`if: failure()\`, \`permissions: { issues: write }\` and a step using \`${failureReportAction}\`, as .github/workflows/mutation.yml does.`,
      problem: `This workflow runs on a schedule but files nothing when it fails, so its red would only ever appear in the Actions tab.`,
    }));
}

function checkVerifiedDownloads(
  workflows: readonly Workflow[],
): PolicyViolation[] {
  const violations: PolicyViolation[] = [];

  for (const workflow of workflows) {
    for (const job of workflow.jobs) {
      const body = job.lines.join("\n");
      if (!releaseDownload.test(body) || checksumVerification.test(body)) {
        continue;
      }
      violations.push({
        file: workflow.file,
        fix: `Pipe the expected digest into \`sha256sum --check --strict\` in the same job, taking it from the release's own checksums file.`,
        problem: `Job "${job.id}" downloads a release without verifying a checksum, so the bytes it runs are whatever the server returns.`,
      });
    }
  }

  return violations;
}

type RulesetFile = {
  readonly file: string;
  readonly json: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readRulesets(root: string): RulesetFile[] {
  const directory = path.join(root, rulesetDirectory);
  if (!existsSync(directory)) {
    return [];
  }

  const files: RulesetFile[] = [];
  for (const entry of readdirSync(directory).sort()) {
    if (!entry.endsWith(".json")) {
      continue;
    }
    const file = `${rulesetDirectory}/${entry}`;
    const parsed: unknown = JSON.parse(readText(root, file) ?? "{}");
    const json = asRecord(parsed);
    if (json !== undefined) {
      files.push({ file, json });
    }
  }
  return files;
}

function rulesOf(ruleset: Record<string, unknown>): Record<string, unknown>[] {
  const rules = ruleset.rules;
  return Array.isArray(rules)
    ? rules.flatMap((rule) => {
        const record = asRecord(rule);
        return record === undefined ? [] : [record];
      })
    : [];
}

function requiredContexts(ruleset: Record<string, unknown>): string[] {
  const rule = rulesOf(ruleset).find(
    (entry) => entry.type === "required_status_checks",
  );
  const parameters = asRecord(rule?.parameters);
  const checks = parameters?.required_status_checks;

  return Array.isArray(checks)
    ? checks.flatMap((check) => {
        const context = asRecord(check)?.context;
        return typeof context === "string" ? [context] : [];
      })
    : [];
}

function advancedSecurityContexts(file: Record<string, unknown>): string[] {
  const optional = asRecord(
    file.requiresAdvancedSecurity,
  )?.requiredStatusChecks;
  return Array.isArray(optional)
    ? optional.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function checkRulesetPayload(
  rulesets: readonly RulesetFile[],
): PolicyViolation[] {
  const violations: PolicyViolation[] = [];

  for (const { file, json } of rulesets) {
    const ruleset = asRecord(json.ruleset);
    if (ruleset === undefined) {
      violations.push({
        file,
        fix: `Wrap the API payload in a "ruleset" property; \`pnpm repo:host\` sends that object verbatim.`,
        problem: `${file} carries no "ruleset" object.`,
      });
      continue;
    }

    if (ruleset.enforcement !== "active") {
      violations.push({
        file,
        fix: `Set "enforcement" to "active"; "evaluate" reports violations without blocking them.`,
        problem: `The ruleset is not enforced.`,
      });
    }

    const bypass = ruleset.bypass_actors;
    if (!Array.isArray(bypass) || bypass.length > 0) {
      violations.push({
        file,
        fix: `Keep "bypass_actors" empty and pass \`--allow-admin-bypass\` when a single maintainer genuinely needs one, so the exception lives in the invocation.`,
        problem: `The checked-in ruleset grants a bypass, which makes the committed file weaker than it reads.`,
      });
    }

    const present = new Set(
      rulesOf(ruleset).flatMap((rule) =>
        typeof rule.type === "string" ? [rule.type] : [],
      ),
    );
    for (const [type, consequence] of Object.entries(requiredRuleTypes)) {
      if (!present.has(type)) {
        violations.push({
          file,
          fix: `Add \`{ "type": "${type}" }\` back to the rules array.`,
          problem: `The ruleset has no ${type} rule, so ${consequence}.`,
        });
      }
    }

    const pullRequest = rulesOf(ruleset).find(
      (rule) => rule.type === "pull_request",
    );
    const parameters = asRecord(pullRequest?.parameters);
    if (pullRequest !== undefined) {
      for (const name of requiredPullRequestParameters) {
        if (parameters === undefined || !(name in parameters)) {
          violations.push({
            file,
            fix: `Add "${name}" to the pull_request rule's parameters; the REST API rejects the payload without it.`,
            problem: `The pull_request rule omits the required parameter ${name}.`,
          });
        }
      }
    }
  }

  return violations;
}

function checkRequiredChecksReport(
  rulesets: readonly RulesetFile[],
  workflows: readonly Workflow[],
): PolicyViolation[] {
  const violations: PolicyViolation[] = [];

  const reporters = new Map<string, Workflow>();
  for (const workflow of workflows) {
    for (const job of workflow.jobs) {
      reporters.set(job.checkName, workflow);
    }
  }

  for (const { file, json } of rulesets) {
    const ruleset = asRecord(json.ruleset) ?? {};
    const contexts = [
      ...requiredContexts(ruleset),
      ...advancedSecurityContexts(json),
    ];

    for (const context of contexts) {
      const workflow = reporters.get(context);
      if (workflow === undefined) {
        violations.push({
          file,
          fix: `Name a job that exists — the check name is the job's \`name:\`, or its id when it has none.`,
          problem: `Required status check "${context}" matches no job in ${workflowDirectory}, so a pull request would wait for it forever.`,
        });
        continue;
      }

      const trigger = workflow.triggers.find(
        (entry) => entry.name === "pull_request",
      );
      if (trigger === undefined) {
        violations.push({
          file: workflow.file,
          fix: `Add a \`pull_request:\` trigger, or stop requiring "${context}" in ${file}.`,
          problem: `Required status check "${context}" never runs on a pull request, so it can never report.`,
        });
        continue;
      }

      if (trigger.hasPathFilter) {
        violations.push({
          file: workflow.file,
          fix: `Remove the paths filter from the \`pull_request:\` trigger; a required check must report on every pull request.`,
          problem: `Required status check "${context}" sits behind a paths filter, so a pull request touching nothing it matches could never merge.`,
        });
      }
    }
  }

  return violations;
}

function checkPnpmSupplyChain(root: string): PolicyViolation[] {
  const violations: PolicyViolation[] = [];

  const manifestText = readText(root, rootManifest);
  if (manifestText !== undefined) {
    const parsed: unknown = JSON.parse(manifestText);
    const pnpmSettings = asRecord(asRecord(parsed)?.pnpm);
    if (pnpmSettings !== undefined) {
      violations.push({
        file: rootManifest,
        fix: `Move these keys into ${workspaceManifest} and delete the "pnpm" block; pnpm reads both, and for a key in both the workspace file silently wins.`,
        problem: `The root manifest holds a second copy of pnpm settings (${Object.keys(pnpmSettings).join(", ")}), which reads as enforced while ${workspaceManifest} decides.`,
      });
    }
  }

  const workspace = readText(root, workspaceManifest);
  if (workspace === undefined) {
    return violations;
  }

  if (!/^onlyBuiltDependencies\s*:/m.test(workspace)) {
    violations.push({
      file: workspaceManifest,
      fix: `Add an \`onlyBuiltDependencies\` list; without it pnpm asks interactively and a non-interactive install silently runs nothing.`,
      problem: `${workspaceManifest} declares no lifecycle-script allowlist.`,
    });
  }

  const releaseAge = /^minimumReleaseAge\s*:\s*(\d+)/m.exec(workspace);
  const minutes = Number(releaseAge?.[1] ?? "0");
  if (minutes <= 0) {
    violations.push({
      file: workspaceManifest,
      fix: `Set \`minimumReleaseAge\` to at least a day (1440) so a compromised release is usually yanked before this repository resolves it.`,
      problem: `${workspaceManifest} sets no minimumReleaseAge, so a version published minutes ago can enter the lockfile.`,
    });
  }

  for (const setting of forbiddenPnpmSettings) {
    if (new RegExp(`^${setting}\\s*:`, "m").test(workspace)) {
      violations.push({
        file: workspaceManifest,
        fix: `Remove \`${setting}\` and keep \`onlyBuiltDependencies\` as the single allowlist.`,
        problem: `${setting} widens or replaces the lifecycle-script allowlist.`,
      });
    }
  }

  return violations;
}

function checkCodeowners(root: string): PolicyViolation[] {
  const text = readText(root, codeownersPath);
  if (text === undefined) {
    return [
      {
        file: codeownersPath,
        fix: `Add ${codeownersPath} naming an owner for ${harnessOwnedPaths.join(", ")}; the ruleset's require_code_owner_review has nothing to require without it.`,
        problem: `The repository has no CODEOWNERS file.`,
      },
    ];
  }

  const owned = text
    .split("\n")
    .map((line) => withoutComment(line).trim())
    .filter((line) => line.length > 0 && /(@\S+|\S+@\S+\.\S+)/.test(line))
    .map((line) => line.split(/\s+/)[0] ?? "");

  return harnessOwnedPaths
    .filter((pattern) => !owned.includes(pattern))
    .map((pattern) => ({
      file: codeownersPath,
      fix: `Add a \`${pattern}\` entry naming an owner.`,
      problem: `${pattern} has no code owner, so a change to it needs no explicit review.`,
    }));
}

/** Every way the repository host and the supply chain can be loosened. */
export function checkWorkflowPolicy(root: string): PolicyViolation[] {
  const workflows = readWorkflows(root);
  const rulesets = readRulesets(root);

  return [
    ...checkActionPins(workflows),
    ...checkWorkflowPermissions(workflows),
    ...checkVerifiedDownloads(workflows),
    ...checkScheduledSensorsReport(workflows),
    ...checkRulesetPayload(rulesets),
    ...checkRequiredChecksReport(rulesets, workflows),
    ...checkPnpmSupplyChain(root),
    ...checkCodeowners(root),
  ];
}
