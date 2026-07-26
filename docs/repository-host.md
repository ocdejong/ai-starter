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
requires linear history, requires a pull request with an approving code-owner
review and resolved conversations, and requires the status checks below to pass
on a branch that is up to date with the base.

The command also sets the repository-level facts a ruleset cannot express:
squash and rebase merges only (a merge commit cannot produce linear history),
branch deletion on merge, secret scanning with push protection, Dependabot alerts
and security updates, and private vulnerability reporting.

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

## Review of harness files

`.github/CODEOWNERS` gives `AGENTS.md`, `.github/` and `packages/tooling/` an
owner, and the ruleset sets `require_code_owner_review`, so changing what the
harness is allowed to do needs an explicit approving review.

A sole maintainer cannot approve their own pull request, so on a one-person
repository this is a stop sign rather than a review. `pnpm repo:host
--allow-admin-bypass` adds the authenticated user to the ruleset's bypass actors
and prints who it granted. The checked-in file always carries an empty
`bypass_actors` list: the weakening belongs to the command that made it, where a
reader will see it, rather than to a file they will skim.

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
