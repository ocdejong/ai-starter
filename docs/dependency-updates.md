# Dependency updates

Dependabot opens pull requests against this repository every Monday. This document is the answer to the question those pull requests kept asking and nobody kept answering: whose job is a red bump, and what does a bump that cannot pass on its own get instead of a merge.

## The rule

**Every proposal ends before the run that supersedes it.** There are exactly three endings:

1. **Merged**, because the suite is green on the tree that lands.
2. **Repaired and merged**, because the red was mechanical and somebody did the mechanical part.
3. **Closed, with the reason written in the pull request.** A decline is legitimate — this repository pins some things deliberately — but the reason lives in the pull request, where the next reader meets it, and never in somebody's memory.

A proposal with no ending is the only outcome that is not allowed, and it is the one this repository actually produced: eleven open pull requests, seven of them red, for a week. Nothing failed while that was true. `main` was green throughout, because a red on a branch is invisible to every gate a pull request runs.

## Who receives the red

`pnpm deps:backlog` ages every open Dependabot proposal and fails when one has outlived the weekly cadence that produced it, plus a day of grace. It runs as a job in `.github/workflows/sensors.yml`, and its failure files an issue under `sensor:dependencies` through `.github/actions/report-failure` — the same channel the suite, link and advisory sensors use.

It is deliberately **not** in `pnpm verify`. Its answer depends on the state of the host rather than on the contents of a diff, and a check no commit can turn green must never be able to block one. Run it by hand at any time:

```bash
pnpm deps:backlog
```

Without credentials, or in a checkout with no `.github/dependabot.yml`, it skips and says which. A downstream product that never enabled Dependabot gets silence, not a red.

## Working a red proposal

Read the failing `Verify` log before deciding anything; the class of failure decides the ending.

**The branch is merely behind.** Comment `@dependabot rebase`. This costs nothing and resolves both `BEHIND` and most `DIRTY` states.

**The red is mechanical** — formatting, generated output, a lockfile that needs regenerating. Dependabot cannot run a repository command, so a person or an agent pushes the companion commit:

```bash
git fetch origin
git switch --detach origin/<the dependabot branch>
git switch -c <the dependabot branch>
pnpm install
pnpm format          # or the regenerating command the log names
git commit -am "chore(deps): reformat for the bump above"
git push
```

Pushing to a Dependabot branch makes Dependabot stop managing it, so do this when the merge is next rather than as housekeeping: from that point the rebases are yours too. The canonical case is a Prettier bump, which reformats files the bump never touched — `format:check` fails, and no version of the proposal can ever fix it by itself.

**The red is a coupled sibling.** A package whose major needs another package's major arrives red however long it waits. Group the family in `.github/dependabot.yml` so the next run proposes them together, close the split proposal naming the group, and let the schedule re-propose. The three families already grouped there — `eslint`, `prisma`, `jest` — each carry the failure that proved the coupling, and each was a pull request that could never have gone green.

**The red is a migration.** A deprecation to remove, an API that moved, a peer that has not caught up. Close it, write what the migration requires in the pull request, and open an issue for the work. `@dependabot ignore this major version` stops the same major being re-proposed weekly while leaving the next one to arrive normally — use it only alongside that issue, because an ignore with nothing tracking it is how a deliberate deferral becomes an accidental pin.

**The bump is declined on purpose.** Say what the pin protects. `@types/node` tracks the `engines.node` major this repository supports rather than the newest release, because typing against a newer runtime lets code compile that the supported one cannot run — that is a pin, not neglect, and the pull request says so.

## What the loop cannot decide for you

`pnpm audit --audit-level high` is the advisory sensor, and taking a bump is one of the two ways to clear it; the other is an override in `pnpm-workspace.yaml` naming the advisory and the line it applies to. Raising `--audit-level` is not a third way. `docs/repository-host.md` covers the supply-chain guards around what a proposal is allowed to change.
