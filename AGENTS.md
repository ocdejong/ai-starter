# Agent contract

This repository is designed to be changed by coding agents. Treat this file as binding. Read `docs/engineering-principles.md` before every code change, then use `docs/README.md` to load only the architecture, testing, or research context relevant to the task.

This file is the only place repository rules are written. The files each agent loads on its own — `CLAUDE.md`, `GEMINI.md`, `.cursor/rules/repository.mdc` and `.github/copilot-instructions.md` — are generated pointers back to it; change a rule here and run `pnpm instructions:write`. A package carries its own `AGENTS.md` only for rules that genuinely differ from this contract, and `pnpm instructions` fails when a pointer goes stale, a rule is restated, or a referenced document stops resolving. `docs/README.md` explains the mechanism.

## Non-negotiable invariants

- Keep TypeScript `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes` enabled. Do not use `any`, non-null assertions, or `@ts-ignore` to bypass a design problem.
- Validate every untrusted runtime boundary with Zod. TypeScript types alone are not validation.
- Preserve dependency direction: apps compose the API and infrastructure adapters; API → domain; DB → PostgreSQL. `domain` and `tokens` remain platform-neutral; `db` remains server-only.
- Put side effects and volatile vendors behind narrow, consumer-owned contracts. Wire concrete adapters only at a composition root; do not create speculative abstractions around stable pure code.
- Client code may import `@ai-starter/api/client`, never `@ai-starter/db` or the server entry point of `@ai-starter/api`.
- Persisted invariants belong in PostgreSQL constraints as well as application validation. Use transactions for multi-write operations that must succeed or fail together.
- Never commit secrets or generated Prisma output. Public environment variables are not secret.
- Keep web and native UI separate. Share schemas, business logic, API types, and tokens—not DOM or React Native components.
- Every colour in product UI comes from `packages/tokens`, and every string a person reads comes from both message catalogs in `packages/i18n`. Punctuation around a translated string is copy too: a locale may not punctuate the way English does.
- Do not disable or focus a test, swallow an error in an empty `catch`, or assert between unrelated types by laundering through `unknown`. Each reports a confidence the code has not earned. The two suppressions that survive — a described `@ts-expect-error` and a justified `eslint-disable` — are counted against a list that may only shrink, so adding one is a decision somebody records rather than a habit.
- Delete what a change orphans. An export widened for a caller that has since moved, and a module the slice replacing it left behind, both still compile and still pass their own tests.
- Prefer the smallest change that satisfies the requirement. Add dependencies and abstractions only when the product needs them.

ESLint encodes many of these boundaries per file; `pnpm arch` (dependency-cruiser) enforces the direction and acyclicity across the whole module graph, `pnpm policy` enforces the structural rules the graph cannot see, and `pnpm knip` fails on the files, exports and dependencies nothing reaches at all. Do not weaken a rule to make a change pass; fix the dependency direction. The ordered golden principles and anti-rationalization rules in `docs/engineering-principles.md` are binding even where automation cannot yet enforce them.

## Where code belongs

- `apps/web`: Next.js routes, web UI, Better Auth adapter, HTTP adapters, and the server composition root.
- `apps/mobile`: Expo Router, native UI, and the mobile tRPC client.
- `packages/api`: framework-independent tRPC context, procedures, routers, use-case orchestration, and consumer-owned ports.
- `packages/domain`: Zod schemas and deterministic business logic.
- `packages/db`: Prisma schema, migrations, server-only client, and persistence adapters.
- `packages/auth`: the `initAuth` factory over Better Auth — account, group, and session flows, the personal-group hooks, and the demo seed. Server-only; each app owns its own client.
- `packages/email`: react-email templates plus the Resend and dev-mailbox adapters behind the `EmailSender` port `packages/api` declares.
- `packages/config`: shared compiler, lint, and test configuration.
- `packages/i18n`: shared EN/NL ICU message catalogs, the `Locale` schema, and locale negotiation. Platform-neutral; consumed by both apps.
- `packages/tokens`: plain cross-platform design values.
- `packages/tooling`: repository commands (`bootstrap`, `db:lint`, `diagnose`, `generate`, `instructions`, `links:check`, `policy`, `rehearse:template`, `repo:host`, `test:e2e:mobile`, `verify`, `verify:changed`, `starter:init`). Node built-ins only: `diagnose` must inspect a checkout whose dependencies are missing or broken, so nothing in this package may import an installed dependency. Editing it also requires `packages/tooling/AGENTS.md`.

## Getting a checkout running

`pnpm bootstrap` takes a clean clone to a runnable, migrated local environment and is safe to run repeatedly. `pnpm diagnose` reports what is missing and names the command that fixes it. `pnpm starter:init` is the one-time downstream initializer; see `README.md`.

## Adding a feature

`pnpm rehearse:template` runs the whole golden path the way a downstream product first meets it — instantiate, `starter:init`, `bootstrap`, every generator, then the full suite over the result — and is the only check that compiles what the adapter generator emits. It runs weekly in CI; run it by hand after changing a generator, a template or `starter:init`.

`pnpm generate feature <name>` writes a vertical slice in the product's own words and registers it in every place a feature has to be registered; `pnpm generate context <name>` writes the domain half alone, and `pnpm generate adapter <name>` writes a consumer-owned port with a vendor-free adapter behind it. Run `pnpm generate --help` for what each emits. Generated output is expected to pass `pnpm verify:changed` untouched, and the command names the two things it cannot do: creating the migration — whose SQL it dictates verbatim, both timeouts included, because `pnpm db:lint` rejects the file Prisma writes on its own — and translating the Dutch catalog entries. The committed `announcement` slice is that generator's output — `packages/tooling/src/generators/golden-path.test.ts` fails if it stops being — so read it, or regenerate it, rather than copying an older feature by hand.

## Required workflow

1. Inspect the closest implementation, public contract, callers, tests, and recent history before editing. Run the relevant baseline test first.
2. State acceptance criteria and identify the owning domain/layer. Keep the change to one narrow vertical slice.
3. Put validation and deterministic rules in `packages/domain` first; keep side effects in adapters.
4. For changed behavior, use red-green testing where practical: observe the focused test fail, implement, then observe it pass. Use real PostgreSQL for persistence behavior.
5. Change Prisma through a migration. For unsupported features such as CHECK constraints, create the migration without applying it, edit its SQL, then apply it.
6. Inspect the finished diff and exercise the real user/runtime interface appropriate to the risk.
7. Run `pnpm verify:changed` while iterating, then `pnpm verify` before handing off.
8. Commit one coherent, verified change at a time with an imperative commit message. Leave no unrelated or half-finished state.

```bash
pnpm verify:changed   # only the checks the current diff can affect
pnpm verify           # the complete authoritative suite, in CI's order
```

`pnpm verify` owns the list of required checks; `packages/tooling/src/verification.ts` is its single definition, and CI runs the same command. Do not assemble a verification sequence from memory, and do not weaken or reorder the list to land a change.

For a schema change:

```bash
pnpm db:migrate:dev --name descriptive_change --create-only
# Inspect and, when needed, edit migration.sql.
pnpm db:lint
pnpm db:migrate:dev
pnpm test:integration
```

`pnpm db:lint` runs Squawk over every migration written since the gate landed and names the exact line to add. Expect to prefix a new migration with `set lock_timeout` and `set statement_timeout`: Prisma applies the file inside a transaction, so both are transaction-local, and without them a schema change waits behind whatever is already holding the table. `.squawk.toml` records the two rules this repository excludes and why.

`pnpm db:push:prototype` is a disposable prototyping escape hatch. Never use it for a shared or deployed database; it refuses to run unless `DATABASE_URL` resolves to a local host, so change a shared database through a migration instead.

## Testing rules

- Domain/web units and web components: Vitest; web interaction assertions: Testing Library.
- Native components: Jest through `jest-expo` and React Native Testing Library.
- Database behavior: Testcontainers with actual migrations and PostgreSQL.
- Critical web journeys: Playwright. Critical native journeys: Maestro.
- Test observable behavior, constraints, and failure cases. Avoid snapshots unless the serialized structure itself is the contract.
- Never mock the database in a test intended to prove persistence integrity.

## Security and integrations

- Keep third-party SDKs behind a small adapter and validate their responses with Zod before passing data into domain logic.
- Sentry is disabled without a DSN and must keep `sendDefaultPii: false` unless a documented privacy decision changes it.
- Never log credentials, authorization headers, full provider payloads, or sensitive user content.
- A workflow that runs on a schedule must file an issue when it fails, through `.github/actions/report-failure`; `pnpm policy` rejects one that does not. A red that only ever appears in the Actions tab is a signal nobody receives.
- The repository host is configuration, not folklore: `.github/rulesets/main.json` and `.github/CODEOWNERS` are checked in, `pnpm repo:host` applies them, and `pnpm policy` fails when a workflow, an action pin, or a pnpm setting drifts from what `docs/repository-host.md` describes.

## Completion criteria

A task is not complete while `pnpm verify` fails. Completion MUST report concrete verification evidence and any check that could not run. Do not silently skip a gate, claim success from code inspection alone, or hand a reviewer output you have not reviewed.
