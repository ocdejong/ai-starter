# Dependency updates

Dependabot opens pull requests against this repository once a month, at most three at a time, grouped so a month of updates arrives as a few proposals rather than dozens. Every proposal is a pull request and so costs one full CI run once it is ready for review; the cadence and the cap are what keep that bill small. This document answers whose job a red bump is, and what a bump that cannot pass on its own gets instead of a merge.

## The rule

**Every proposal ends before the next run proposes it again.** There are exactly three endings:

1. **Merged**, because the suite is green on the tree that lands.
2. **Repaired and merged**, because the red was mechanical and somebody did the mechanical part.
3. **Closed, with the reason written in the pull request.** A decline is legitimate — this repository pins some things deliberately — but the reason lives in the pull request, where the next reader meets it, and never in somebody's memory.

A proposal with no ending is the outcome to avoid, and no sensor catches it: `main` stays green while a red bump waits, because a red on a branch is invisible to every gate another pull request runs. Look at the open proposals when the monthly run lands.

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

**The red is a migration.** A deprecation to remove, an API that moved, a peer that has not caught up. Close it, write what the migration requires in the pull request, and open an issue for the work. `@dependabot ignore this major version` stops the same major being re-proposed every month while leaving the next one to arrive normally — use it only alongside that issue, because an ignore with nothing tracking it is how a deliberate deferral becomes an accidental pin.

**The red is upstream, and nothing here can clear it.** A peer that caps below the proposed major, a package the SDK pins, a transitive nothing in this repository declares. Close it with the reason — and **record the block in `packages/tooling/src/upstream-blocks.ts`**, because this is the one class of decline with no local trigger: the group re-proposes monthly, fails identically, and the day upstream ships the fix nothing notices. `pnpm deps:upstream` reads those manifests and fails when one stops saying what is recorded, which happens exactly when the block clears:

```bash
pnpm deps:upstream
```

Its red means the recorded list is stale rather than something being broken, which is the same question the other sensors ask — _is something wrong that nobody has noticed_ — pointed at somebody else's release schedule. A block that clears is deleted from that file in the same change that takes the bump; the list is the backlog, not a log.

**The bump is declined on purpose.** Say what the pin protects. `@types/node` tracks the `engines.node` major this repository supports rather than the newest release, because typing against a newer runtime lets code compile that the supported one cannot run — that is a pin, not neglect, and the pull request says so.

## What the loop cannot decide for you

`pnpm audit --audit-level high` is the advisory sensor, and taking a bump is one of the two ways to clear it; the other is an override in `pnpm-workspace.yaml` naming the advisory and the line it applies to. Raising `--audit-level` is not a third way. `docs/repository-host.md` covers the supply-chain guards around what a proposal is allowed to change.
