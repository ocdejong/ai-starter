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

`Verify`, `Workflows` and `Secrets` are required. `Analyze JavaScript and
TypeScript` and `Dependencies` are not, because code scanning and the dependency
graph need a public repository or GitHub Advanced Security — on a private
repository without either, those jobs fail no matter what the code says. Once one
of those holds, `pnpm repo:host --code-scanning` adds them.

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

`pnpm verify` stays the one functional check list, and CI runs that exact
command. The scanners are additive jobs beside it, the way CodeQL already was:
`.github/workflows/supply-chain.yml` runs actionlint and zizmor over the
workflows, gitleaks over the tree, and dependency review over a pull request's
dependency changes. What those tools catch on the server, `pnpm policy` catches
in the working copy, so an agent does not have to push to learn it broke a rule.
