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

`pnpm audit --audit-level high` is the advisory sensor, and taking a bump is one of the two ways to clear it; the other is an override in `pnpm-workspace.yaml` naming the advisory and the line it applies to. Raising `--audit-level` is not a third way, and neither is an ignore without a recorded block: see "Working the advisory report" below. `docs/repository-host.md` covers the supply-chain guards around what a proposal is allowed to change.

## Working the advisory report

The sensor's issue lists every advisory the lockfile resolves at high or above, and the path column decides the remedy the same way the `Verify` log decides a proposal's ending. Read the path from the right: the last name is the vulnerable package, the name before it is the parent whose declared range decides whether a fix can reach it.

**A direct dependency with a proposal open.** Merge the proposal; the advisory clears with it. When the bump also widens a range for a transitive advisory, follow the merge with `pnpm update <transitive>` so the lockfile takes the move the parent now permits — `next@16` allowing a newer `sharp` than `next@15` did is the recorded example.

**A transitive the parent's range already allows.** The fixed version satisfies what the parent declares, so nothing but the lockfile stands in the way. `pnpm update <package>` reaches it without an override when a single line is affected, and leaves nothing to explain. When pnpm keeps the stale version anyway — it reuses the lockfile's resolution for a peer it auto-installed, `mysql2` under `better-auth` being the recorded example — add an override in `pnpm-workspace.yaml` naming the advisory, and select the _line_ rather than the name when more than one major coexists: `brace-expansion@^1: ^1.1.20` is the recorded example, and the reason a bare key would break ESLint is written beside it.

**A transitive the parent caps below the fix.** `@prisma/config` declaring `deepmerge-ts` at exactly 7.1.5 is this case: no override honours the parent's range, and an override that ignores it runs code the parent never claimed to support. Record it in `packages/tooling/src/upstream-blocks.ts` against the parent's manifest, exactly as a declined major is, so the upstream sensor reports the day the range moves, and list its GHSA under `auditConfig.ignoreGhsas` in `pnpm-workspace.yaml` with the path that reaches it. Both entries leave in the same change that takes the fix. An ignore is a decision about one advisory on one path and carries its reason beside it; it is never a threshold. Before adding one, answer whether the path is a development-time tool or a deployed artefact: this one is the Prisma CLI's config loader, which ships in no build.

**An advisory with no patched version anywhere.** `braces` and `node-forge`, whose newest releases are the vulnerable ones, are the recorded cases. Nothing a person does clears the row, so the sensor runs `pnpm audit --audit-level high --ignore-unfixable` and skips it. That ignore expires by itself: the day a patched release is published the advisory becomes fixable, stops being skipped and the sensor goes red, at which point it is one of the classes above. Prefer it to an `ignoreGhsas` entry, which would stay in force after the fix lands. Locally, run the bare `pnpm audit --audit-level high` to see those rows too; do not add `--ignore-unfixable` locally, because pnpm writes what it skipped into `pnpm-workspace.yaml`.

The report closes when every row has one of these endings.
