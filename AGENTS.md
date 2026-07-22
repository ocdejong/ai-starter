# Agent contract

This repository is designed to be changed by coding agents. Treat this file as binding. Read `docs/architecture.md` and `docs/testing.md` before changing architecture, data access, authentication, or test infrastructure.

## Non-negotiable invariants

- Keep TypeScript `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes` enabled. Do not use `any`, non-null assertions, or `@ts-ignore` to bypass a design problem.
- Validate every untrusted runtime boundary with Zod. TypeScript types alone are not validation.
- Preserve dependency direction: apps → api → domain/db; `domain` and `tokens` remain platform-neutral; `db` remains server-only.
- Client code may import `@t3-test/api/client`, never `@t3-test/db` or the server entry point of `@t3-test/api`.
- Persisted invariants belong in PostgreSQL constraints as well as application validation. Use transactions for multi-write operations that must succeed or fail together.
- Never commit secrets or generated Prisma output. Public environment variables are not secret.
- Keep web and native UI separate. Share schemas, business logic, API types, and tokens—not DOM or React Native components.
- Prefer the smallest change that satisfies the requirement. Add dependencies and abstractions only when the product needs them.

ESLint encodes many of these boundaries. Do not weaken a rule to make a change pass; fix the dependency direction.

## Where code belongs

- `apps/web`: Next.js routes, web UI, Better Auth adapter, server actions, and HTTP adapters.
- `apps/mobile`: Expo Router, native UI, and the mobile tRPC client.
- `packages/api`: framework-independent tRPC context, procedures, and routers.
- `packages/domain`: Zod schemas and deterministic business logic.
- `packages/db`: Prisma schema, migrations, and the server-only client.
- `packages/config`: shared compiler, lint, and test configuration.
- `packages/tokens`: plain cross-platform design values.

## Required workflow

1. Inspect the closest existing implementation and tests before editing.
2. Put validation and deterministic rules in `packages/domain` first.
3. Change Prisma through a migration. For unsupported features such as CHECK constraints, create the migration without applying it, edit its SQL, then apply it.
4. Add the narrowest useful test. Use real PostgreSQL for database behavior.
5. Run the checks proportional to the change; run the complete verification sequence before handing off.
6. Commit one coherent, verified change at a time with an imperative commit message.

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm db:validate
pnpm db:generate
pnpm test:unit
pnpm test:integration
pnpm build
pnpm test:e2e       # when web behavior changed
```

For a schema change:

```bash
pnpm db:migrate:dev --name descriptive_change --create-only
# Inspect and, when needed, edit migration.sql.
pnpm db:migrate:dev
pnpm test:integration
```

`pnpm db:push:prototype` is a disposable prototyping escape hatch. Never use it for a shared or deployed database.

## Testing rules

- Domain/web units and web components: Vitest; web interaction assertions: Testing Library.
- Native components: Jest through `jest-expo` and React Native Testing Library.
- Database behavior: Testcontainers with actual migrations and PostgreSQL.
- Critical web journeys: Playwright. Critical native journeys: Maestro.
- Test observable behavior, constraints, and failure cases. Avoid snapshots unless the serialized structure itself is the contract.
- Never mock the database in a test intended to prove persistence integrity.

## Security and integrations

- Keep OAuth login scopes minimal. Request calendar or other provider scopes later through explicit account linking/consent.
- Treat OAuth access and refresh tokens as secrets. Better Auth provider tokens require a deliberate encryption and rotation design before handling sensitive production integrations.
- Keep third-party SDKs behind a small adapter and validate their responses with Zod before passing data into domain logic.
- Sentry is disabled without a DSN and must keep `sendDefaultPii: false` unless a documented privacy decision changes it.
- Never log credentials, authorization headers, full provider payloads, or sensitive user content.

## Completion criteria

A task is not complete while formatting, lint, typecheck, relevant tests, or production build fail. Report any check that cannot run and why. Do not silently skip a failing gate.
