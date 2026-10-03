# Repository host and supply chain

Everything the harness enforces locally can be bypassed by pushing straight to
the default branch, and everything it verifies can be poisoned by a dependency
or an action nobody chose. This document covers the half that lives outside the
checkout: what GitHub is configured to refuse, how a downstream product replays
that configuration in one command, and which guarantees depend on a plan this
repository does not have.

## The one-command replay

```bash
pnpm repo:host --dry-run   # read the host, print the requests, send nothing
pnpm repo:host             # apply the difference
```

The command targets the `origin` remote unless `--repo owner/name` says
otherwise, and takes credentials from `GITHUB_TOKEN`, `GH_TOKEN`, or
`gh auth token`. It reads the host before every write and sends only the
difference, so a second run reports `unchanged` for every line and issues no
write requests at all. `GITHUB_API_URL` points it at GitHub Enterprise Server.

A downstream product runs it once after instantiation, having first replaced the
handle in `.github/CODEOWNERS` — that file names people, and `pnpm starter:init`
only rewrites the product identity.

## What it applies

`.github/rulesets/main.json` is the branch ruleset. Its `ruleset` property is the
verbatim body of `POST /repos/{owner}/{repo}/rulesets`; the rest of the file is
context for a reader. On the default branch it blocks deletion and force pushes,
requires linear history, requires a pull request with resolved conversations, and
requires the status checks below to pass on a branch that is up to date with the
base.

The command also sets the repository-level facts a ruleset cannot express:
squash and rebase merges only (a merge commit cannot produce linear history),
branch deletion on merge, secret scanning with push protection, Dependabot alerts
and security updates, and private vulnerability reporting.

## Applying it changes how the repository is developed

This is the point of the ruleset rather than a side effect, and it is worth
saying out loud before the first run. Afterwards nobody pushes to the default
branch — not the owner, not an agent, not a script — and a branch lands as a
squash or a rebase, never as a merge commit. A workflow built on "merge the
default branch into the topic branch, then fast-forward the default branch"
stops working the moment the ruleset is active, because it does both of the
things the ruleset refuses.

Deciding to keep that workflow means deciding not to enforce the branch, so the
choice belongs here rather than in a commit that quietly loosens a rule.

## Required checks must be able to report

A required status check that never reports leaves every pull request pending
forever. Three rules follow, and `pnpm policy` enforces all three:

- Every workflow supplying a required check triggers on `pull_request`.
- No such workflow carries a `paths:` filter, because a pull request touching
  nothing in the filter would never report.
- The context name is the job's `name:`, or its id when it has none.

`Verify` is the one required check. It aggregates five parallel jobs and fails if any fails or is cancelled. The `checks`, `units`, `integration` and `native` lanes share one matrix job and the `web` lane is its own job; each runs `pnpm verify --lane <name>` from the same definition used by local verification. Only the web job starts a service database and installs Chromium. The database integration job provisions its own isolated Testcontainers databases.

The free supply-chain scanners are steps of the `checks` lane, not jobs of their own: actionlint and zizmor over the workflows, and Gitleaks over the checkout. They need no plan and add no runner to a pull request, and a finding fails `Verify` through that lane.

CodeQL and dependency review need a public repository or GitHub Advanced Security, so their jobs run only when `github.event.repository.private == false`; on a private repository they are skipped rather than failed. Neither is required by default, because a required check that never reports blocks every pull request. Once the repository is public and both jobs have reported, `pnpm repo:host --code-scanning` adds their required checks. GitHub documents the private-repository requirements for [code scanning](https://docs.github.com/en/code-security/reference/code-scanning/troubleshoot-analysis-errors/private-repository-enablement) and [dependency review](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependency-review).

## When CI runs

CI runs the full suite once per ready pull request and nowhere else, because every run is billed minutes and agents push often.

- **Open the pull request as a draft.** CI triggers on `opened`, `synchronize`, `reopened` and `ready_for_review`, and every job is skipped while the pull request is a draft, `Verify` included.
- **Iterate locally.** `pnpm verify:changed` is the loop; push as often as the work needs, and nothing runs.
- **Mark it ready when `pnpm verify:changed` passes.** That runs the five lanes once. A later push to the ready pull request runs them again.
- **Nothing runs on a push to `main`.** The pull request already ran that exact tree, and `.github/workflows/sensors.yml` and the weekly CodeQL run cover what a commit cannot.
- **`workflow_dispatch`** runs the same suite by hand on any branch.

A draft pull request cannot be merged, so a skipped `Verify` on a draft does not open a way past the ruleset.

## Private repositories on GitHub Free

Branch rulesets are enforced on a private repository only on a paid plan. On GitHub Free the checked-in ruleset can be created but is not enforced: nothing blocks a direct push to the default branch, and `Verify` is advisory — a red one does not stop a merge. Merging a pull request after `Verify` passes is then a convention the maintainer and the agents keep, not something the host guarantees. Making the repository public, or moving to a paid plan, turns enforcement on without any change to the ruleset file.

## Review, and why the approval count is zero

GitHub does not let anyone approve their own pull request. On a one-person
repository a non-zero approval count is therefore a deadlock, not a gate:
nothing merges, ever, and the only escape is a bypass actor — which also exempts
that actor from the required status checks, giving up the guarantee the ruleset
exists for.

So the count is zero and `require_code_owner_review` is off. What survives is the
part that does the work: no direct pushes, no force-push, no deletion, linear
history, and a green suite before anything lands. An agent opens a pull request
and merges it once the checks pass, with nobody waiting on a human.

`.github/CODEOWNERS` still names an owner for `AGENTS.md`, `.github/` and
`packages/tooling/`, so review is requested on those files even though it does
not block. The day a second reviewer exists, raise the count and turn
`require_code_owner_review` back on — that is the whole change.

`pnpm repo:host --allow-admin-bypass` remains for the case where someone
genuinely needs to push past the ruleset. It is not the answer to a solo
repository, and the checked-in file always carries an empty `bypass_actors` list
so that any weakening lives in the command that caused it.

## Supply chain

- **Actions are pinned to a commit SHA** with a comment naming the release.
  A tag is a moving pointer, and moving it is the whole shape of an action
  compromise. Dependabot updates SHA pins and their comments; `pnpm policy`
  rejects any reference that is not a 40-character SHA, a local `./` action, or
  a `docker://` image pinned by digest.
- **Downloaded tools carry a checksum.** `actionlint` and `gitleaks` are fetched
  as release archives and verified with `sha256sum --check --strict` before they
  run. `pnpm policy` rejects a release download in a job with no checksum
  verification. Dependabot does not maintain these, so the version and the digest
  move together, by hand, from the release's own checksums file.
- **Workflow permissions start empty.** Every workflow declares
  `permissions: {}` and every job states the scopes it needs.
  `pull_request_target` is rejected outright: it runs a fork's code with the base
  repository's secrets.
- **`pnpm-workspace.yaml` is the only place pnpm is configured.** pnpm reads both
  that file and `package.json`, and for a key in both the workspace file silently
  wins — so a second copy reads as enforced while doing nothing.
  `onlyBuiltDependencies` is the single lifecycle-script allowlist, and
  `minimumReleaseAge` keeps a version that was published minutes ago out of the
  lockfile.

## What runs where

`pnpm verify` stays the one functional check list; CI partitions it into lanes. The scanners are additional steps of the `checks` lane in `.github/workflows/ci.yml`, plus an optional dependency-review job that runs only on a public repository. What those tools catch on the server, `pnpm policy` catches in the working copy, so an agent does not have to push to learn it broke a rule.

## Scheduled workflows

Scheduled workflows report a failure by filing an issue through `.github/actions/report-failure`. That action is checked out from this repository, so the reporting job needs `contents: read` as well as `issues: write`: a private repository answers a checkout without it "Repository not found", every report step is skipped, and the sensor fails without telling anyone. `pnpm policy` rejects a job that runs a local action without `contents: read`, from its own `permissions:` or the workflow's.
