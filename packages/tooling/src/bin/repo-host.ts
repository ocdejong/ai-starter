import { ArgumentError, parseArguments } from "../argv.ts";
import { runCapture } from "../command.ts";
import {
  applyRepositoryHost,
  createGitHubClient,
  defaultApiBaseUrl,
  formatPlan,
  formatReport,
  type GitHubClient,
} from "../repository-host-apply.ts";
import {
  type BypassActor,
  parseRepositorySlug,
  readRulesetDefinitions,
  RulesetError,
} from "../repository-host.ts";
import { repositoryRoot } from "../repository.ts";

const usage = `Usage: pnpm repo:host [options]

Applies the checked-in repository-host settings to GitHub: the branch ruleset in
.github/rulesets, merge methods that make linear history achievable, secret
scanning with push protection, Dependabot alerts and security updates, and
private vulnerability reporting. Every write is preceded by the read that
justifies it, so running it twice changes nothing the second time.

Options:
  --repo <owner/name>    Target repository. Defaults to the "origin" remote.
  --dry-run              Print the requests instead of sending them.
  --code-scanning        Also require the checks that need code scanning or a
                         public repository. A required check that cannot report
                         blocks every pull request, so this is opt-in.
  --allow-admin-bypass   Add the authenticated user to the ruleset's bypass
                         actors. The checked-in file never carries one; this
                         keeps the exception visible in the command that made it.

Credentials come from GITHUB_TOKEN, GH_TOKEN, or \`gh auth token\`. Set
GITHUB_API_URL for GitHub Enterprise Server.`;

if (process.argv.includes("--help")) {
  console.log(usage);
} else {
  process.exitCode = await main(process.argv.slice(2));
}

async function main(argv: readonly string[]): Promise<number> {
  let options;
  try {
    options = parseArguments(argv, {
      flags: ["repo"],
      switches: ["dry-run", "code-scanning", "allow-admin-bypass"],
    });
  } catch (error) {
    console.error(
      error instanceof ArgumentError ? error.message : String(error),
    );
    console.error(usage);
    return 1;
  }

  const repository = options.flags.get("repo") ?? originRepository();
  if (repository === undefined) {
    console.error(
      'No repository given and the "origin" remote is not a GitHub URL. Pass --repo <owner/name>.',
    );
    return 1;
  }

  const token = resolveToken();
  if (token === undefined) {
    console.error(
      "No GitHub credentials. Set GITHUB_TOKEN, or sign in with `gh auth login`.",
    );
    return 1;
  }

  let definitions;
  try {
    definitions = readRulesetDefinitions(repositoryRoot);
  } catch (error) {
    console.error(
      error instanceof RulesetError ? error.message : String(error),
    );
    return 1;
  }

  const client = createGitHubClient({
    baseUrl: process.env.GITHUB_API_URL ?? defaultApiBaseUrl,
    token,
  });

  const dryRun = options.switches.has("dry-run");
  let bypassActor: BypassActor | undefined;
  if (options.switches.has("allow-admin-bypass")) {
    bypassActor = await authenticatedActor(client);
    if (bypassActor === undefined) {
      console.error("Could not read the authenticated user to grant a bypass.");
      return 1;
    }
  }

  const report = await applyRepositoryHost({
    bypassActor,
    client,
    codeScanning: options.switches.has("code-scanning"),
    definitions,
    dryRun,
    repository,
  });

  console.log(
    `repo:host ${report.repository}${dryRun ? " (dry run — nothing was sent)" : ""}\n`,
  );
  console.log(formatReport(report));

  if (dryRun && report.planned.length > 0) {
    console.log(`\nRequests this run would send:\n\n${formatPlan(report)}`);
  }

  const failed = report.steps.filter((step) => step.outcome === "failed");
  if (failed.length > 0) {
    console.error(
      `\n${String(failed.length)} setting(s) could not be applied. Each line above names GitHub's own reason.`,
    );
    return 1;
  }

  return 0;
}

function originRepository(): string | undefined {
  const result = runCapture("git", ["remote", "get-url", "origin"], {
    cwd: repositoryRoot,
  });
  return result.code === 0 ? parseRepositorySlug(result.stdout) : undefined;
}

/**
 * `gh` is the fallback rather than the primary so a continuous-integration run
 * needs no extra tool, and so the token this command uses is the one the caller
 * chose rather than whichever account `gh` happens to hold.
 */
function resolveToken(): string | undefined {
  const fromEnvironment = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (fromEnvironment !== undefined && fromEnvironment.trim() !== "") {
    return fromEnvironment.trim();
  }

  const result = runCapture("gh", ["auth", "token"], { cwd: repositoryRoot });
  const token = result.stdout.trim();
  return result.code === 0 && token !== "" ? token : undefined;
}

async function authenticatedActor(
  client: GitHubClient,
): Promise<BypassActor | undefined> {
  const response = await client.request("GET", "/user");
  if (response.status !== 200 || typeof response.body !== "object") {
    return undefined;
  }

  const user = response.body as Record<string, unknown>;
  if (typeof user.id !== "number") {
    return undefined;
  }

  console.log(
    `Granting ${typeof user.login === "string" ? user.login : "the authenticated user"} a ruleset bypass. The checked-in ruleset does not contain it; remove the flag once a second reviewer exists.\n`,
  );

  return { actor_id: user.id, actor_type: "User", bypass_mode: "always" };
}
