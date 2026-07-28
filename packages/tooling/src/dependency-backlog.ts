import { type GitHubClient } from "./repository-host-apply.ts";

/**
 * Whether the dependency-update loop is still moving.
 *
 * Dependabot proposes on a weekly schedule, and every proposal has exactly
 * three legitimate endings: merged, repaired and merged, or closed with the
 * reason written in the pull request. What has no ending is a proposal that
 * simply stays open — and that is the state this repository was actually in,
 * with eleven of them, seven red, for a week nobody noticed. Nothing failed:
 * `main` was green the whole time, because a red on somebody else's branch is
 * invisible to every gate a pull request runs.
 *
 * So this is a scheduled sensor rather than a step in `pnpm verify`. Its answer
 * depends on the state of a host rather than on the contents of a diff, and a
 * check whose result a commit cannot change must never be able to block one.
 */

type PullChecks = "passing" | "failing" | "pending" | "unknown";

export type DependabotPull = {
  readonly number: number;
  readonly title: string;
  /** ISO 8601, as GitHub reports it. */
  readonly createdAt: string;
  readonly checks: PullChecks;
};

export type ReviewedPull = DependabotPull & {
  /** Whole days since the proposal was opened; absent when unreadable. */
  readonly ageInDays: number | undefined;
  readonly stale: boolean;
};

const proposalCycleDays = 7;

/**
 * A proposal is stale once it has outlived the cadence that produced it, plus a
 * day. The cadence is the honest threshold — a bump that survives until the run
 * that supersedes it was never triaged — and the grace day exists because
 * Monday's proposal reaching the following Monday morning is a queue, not
 * neglect.
 */
export const staleAfterDays = proposalCycleDays + 1;

const millisecondsPerDay = 24 * 60 * 60 * 1000;
const recipe = "docs/dependency-updates.md";

function ageOf(createdAt: string, now: Date): number | undefined {
  const opened = Date.parse(createdAt);
  return Number.isNaN(opened)
    ? undefined
    : Math.floor((now.getTime() - opened) / millisecondsPerDay);
}

/**
 * Ages every open proposal, oldest first.
 *
 * An age the runtime cannot compute counts as stale. Every comparison against
 * `NaN` is false, so the alternative is a pull request that can never age out
 * of a sensor built to notice pull requests that do not age out.
 */
export function reviewBacklog(
  pulls: readonly DependabotPull[],
  now: Date,
): ReviewedPull[] {
  return pulls
    .map((pull) => {
      const ageInDays = ageOf(pull.createdAt, now);
      return {
        ...pull,
        ageInDays,
        stale: ageInDays === undefined || ageInDays >= staleAfterDays,
      };
    })
    .sort(
      (left, right) =>
        (right.ageInDays ?? Infinity) - (left.ageInDays ?? Infinity),
    );
}

/** The ending this proposal still owes, in the terms whoever reads it can act on. */
function outstanding(pull: ReviewedPull): string {
  switch (pull.checks) {
    case "passing":
      return "green — merge it, or close it with the reason";
    case "failing":
      return "red — repair it and merge, or close it with the reason";
    case "pending":
      return "still running — wait for it, then merge or close it";
    case "unknown":
      return "no checks reported — rebase it so they run";
  }
}

export function formatBacklog(reviewed: readonly ReviewedPull[]): string {
  const stale = reviewed.filter((pull) => pull.stale);

  // An empty list is ambiguous and must not be read as health: a drained
  // backlog and a channel that stopped proposing look identical from here, and
  // an invalid `.github/dependabot.yml` produces the second without a word.
  if (reviewed.length === 0) {
    return "deps: nothing open. Either the backlog is drained or the channel stopped proposing — check that GitHub accepted .github/dependabot.yml.";
  }

  if (stale.length === 0) {
    return `deps: ${String(reviewed.length)} open proposal(s), none older than ${String(staleAfterDays)} days. The loop is moving.`;
  }

  const lines = stale.map((pull) => {
    const age =
      pull.ageInDays === undefined
        ? `opened ${pull.createdAt}, which is not a date this can read`
        : `${String(pull.ageInDays)} days`;
    return `STALE  #${String(pull.number)}  ${age}  ${pull.checks}  ${pull.title}\n       ${outstanding(pull)}`;
  });

  return [
    ...lines,
    "",
    `deps: ${String(stale.length)} proposal(s) have outlived the weekly run that made them.`,
    `Every one ends merged, repaired and merged, or closed with its reason in the pull request. See ${recipe}.`,
  ].join("\n");
}

/** GitHub's login for the Dependabot app, as it appears on a pull request. */
const dependabotLogins = new Set(["app/dependabot", "dependabot[bot]"]);

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function checksOf(body: unknown): PullChecks {
  const runs = asRecord(body).check_runs;
  if (!Array.isArray(runs) || runs.length === 0) {
    return "unknown";
  }

  const states = runs.map(asRecord);
  if (states.some((run) => run.status !== "completed")) {
    return "pending";
  }
  // `skipped` and `neutral` are how a job that correctly did nothing reports,
  // and this repository has two of them on every pull request.
  const failed = new Set([
    "failure",
    "timed_out",
    "cancelled",
    "action_required",
  ]);
  return states.some((run) => failed.has(asText(run.conclusion)))
    ? "failing"
    : "passing";
}

/**
 * Every open proposal Dependabot owns, with what its checks currently say.
 *
 * A pull request a person opened is deliberately excluded: this sensor answers
 * whether the *automated* channel completes, and a branch of mine sitting open
 * is a different question with a different owner.
 */
export async function readDependabotPulls(
  client: GitHubClient,
  repository: string,
): Promise<DependabotPull[]> {
  const listed = await client.request(
    "GET",
    `/repos/${repository}/pulls?state=open&per_page=100`,
  );

  if (listed.status !== 200 || !Array.isArray(listed.body)) {
    throw new Error(
      `Could not list pull requests for ${repository}: HTTP ${String(listed.status)}${listed.message === "" ? "" : ` — ${listed.message}`}`,
    );
  }

  const pulls: DependabotPull[] = [];

  for (const entry of listed.body) {
    const record = asRecord(entry);
    const login = asRecord(record.user).login;
    if (typeof login !== "string" || !dependabotLogins.has(login)) {
      continue;
    }

    const sha = asRecord(record.head).sha;
    const runs =
      typeof sha === "string"
        ? await client.request(
            "GET",
            `/repos/${repository}/commits/${sha}/check-runs?per_page=100`,
          )
        : undefined;

    pulls.push({
      checks: runs?.status === 200 ? checksOf(runs.body) : "unknown",
      createdAt: asText(record.created_at),
      number: typeof record.number === "number" ? record.number : 0,
      title: asText(record.title),
    });
  }

  return pulls;
}
