import { existsSync } from "node:fs";
import path from "node:path";

import { runCapture } from "../command.ts";
import {
  formatBacklog,
  readDependabotPulls,
  reviewBacklog,
  staleAfterDays,
} from "../dependency-backlog.ts";
import {
  createGitHubClient,
  defaultApiBaseUrl,
} from "../repository-host-apply.ts";
import { parseRepositorySlug } from "../repository-host.ts";
import { repositoryRoot } from "../repository.ts";

const usage = `Usage: pnpm deps:backlog

Reports the Dependabot pull requests that have outlived the weekly run that
proposed them. Every proposal ends merged, repaired and merged, or closed with
the reason written in the pull request; one that just stays open has no ending,
and nothing else in this repository can see it — a red on a branch is invisible
to every gate a pull request runs.

A scheduled sensor rather than a step in \`pnpm verify\`: its answer depends on
the state of the host, and a check no commit can turn green must never block one.

Credentials come from GITHUB_TOKEN, GH_TOKEN, or \`gh auth token\`. Without any,
and in a checkout that never enabled Dependabot, it skips and says why.`;

const dependabotConfig = ".github/dependabot.yml";

if (process.argv.includes("--help")) {
  console.log(usage);
} else {
  process.exitCode = await main();
}

async function main(): Promise<number> {
  if (!existsSync(path.join(repositoryRoot, dependabotConfig))) {
    console.log(
      `deps: skipped — this checkout has no ${dependabotConfig}, so there is no proposal channel to measure.`,
    );
    return 0;
  }

  const repository = process.env.GITHUB_REPOSITORY ?? originRepository();
  if (repository === undefined) {
    console.log(
      'deps: skipped — the "origin" remote is not a GitHub URL, so there is no host to ask.',
    );
    return 0;
  }

  const token = resolveToken();
  if (token === undefined) {
    console.log(
      "deps: skipped — no GitHub credentials. Set GITHUB_TOKEN, or sign in with `gh auth login`.",
    );
    return 0;
  }

  const client = createGitHubClient({
    baseUrl: process.env.GITHUB_API_URL ?? defaultApiBaseUrl,
    token,
  });

  let pulls;
  try {
    pulls = await readDependabotPulls(client, repository);
  } catch (error) {
    // Deliberately a failure rather than a skip: a request that was made and
    // refused is a fact about this repository, and reporting an empty backlog
    // because the token was wrong is the silence this sensor exists to end.
    console.error(
      `deps: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 1;
  }

  const reviewed = reviewBacklog(pulls, new Date());
  const report = formatBacklog(reviewed);

  if (reviewed.every((pull) => !pull.stale)) {
    console.log(report);
    return 0;
  }

  console.error(report);
  console.error(
    `\ndeps: the weekly cadence gives every proposal ${String(staleAfterDays)} days.`,
  );
  return 1;
}

function originRepository(): string | undefined {
  const result = runCapture("git", ["remote", "get-url", "origin"], {
    cwd: repositoryRoot,
  });
  return result.code === 0 ? parseRepositorySlug(result.stdout) : undefined;
}

function resolveToken(): string | undefined {
  const fromEnvironment = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (fromEnvironment !== undefined && fromEnvironment.trim() !== "") {
    return fromEnvironment.trim();
  }

  const result = runCapture("gh", ["auth", "token"], { cwd: repositoryRoot });
  const token = result.stdout.trim();
  return result.code === 0 && token !== "" ? token : undefined;
}
