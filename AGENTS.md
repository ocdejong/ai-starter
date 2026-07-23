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
- Prefer the smallest change that satisfies the requirement. Add dependencies and abstractions only when the product needs them.

ESLint encodes many of these boundaries. Do not weaken a rule to make a change pass; fix the dependency direction. The ordered golden principles and anti-rationalization rules in `docs/engineering-principles.md` are binding even where automation cannot yet enforce them.

## Where code belongs

- `apps/web`: Next.js routes, web UI, Better Auth adapter, HTTP adapters, and the server composition root.
- `apps/mobile`: Expo Router, native UI, and the mobile tRPC client.
- `packages/api`: framework-independent tRPC context, procedures, routers, use-case orchestration, and consumer-owned ports.
- `packages/domain`: Zod schemas and deterministic business logic.
- `packages/db`: Prisma schema, migrations, server-only client, and persistence adapters.
- `packages/config`: shared compiler, lint, and test configuration.
- `packages/tokens`: plain cross-platform design values.
- `packages/tooling`: repository commands (`bootstrap`, `diagnose`, `instructions`, `verify`, `verify:changed`, `starter:init`). Node built-ins only: `diagnose` must inspect a checkout whose dependencies are missing or broken, so nothing in this package may import an installed dependency. Editing it also requires `packages/tooling/AGENTS.md`.

## Getting a checkout running

`pnpm bootstrap` takes a clean clone to a runnable, migrated local environment and is safe to run repeatedly. `pnpm diagnose` reports what is missing and names the command that fixes it. `pnpm starter:init` is the one-time downstream initializer; see `README.md`.

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
pnpm db:migrate:dev
pnpm test:integration
```

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

## Completion criteria

A task is not complete while `pnpm verify` fails. Completion MUST report concrete verification evidence and any check that could not run. Do not silently skip a gate, claim success from code inspection alone, or hand a reviewer output you have not reviewed.
