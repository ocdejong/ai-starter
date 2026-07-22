# Testing

## Commands

| Command                 | Purpose                                            | Prerequisite                                     |
| ----------------------- | -------------------------------------------------- | ------------------------------------------------ |
| `pnpm verify`           | The complete authoritative suite, in CI's order    | A bootstrapped environment                       |
| `pnpm verify:changed`   | Only the checks the current diff can affect        | A git checkout with a resolvable base revision   |
| `pnpm test:unit`        | Domain, web component, and native component suites | Dependencies installed                           |
| `pnpm test:integration` | Prisma migrations and integrity against PostgreSQL | Docker/Podman running                            |
| `pnpm test:e2e`         | Playwright Chromium web journey                    | Local database running and migrated              |
| `pnpm test:e2e:mobile`  | Maestro native smoke flow                          | Maestro plus an installed simulator/device build |
| `pnpm check`            | Lint, typecheck, and unit/component tests          | Dependencies installed                           |

`packages/tooling/src/verification.ts` holds the one ordered definition of the authoritative suite. `pnpm verify`, `pnpm verify:changed` and the CI workflow all read it, so the required checks cannot drift apart. Adding a check means adding it there.

`pnpm verify:changed` selects work from Turborepo's affected graph, plus the rules the graph cannot infer from imports: a change under `packages/db/prisma/` adds schema validation and the real-PostgreSQL tests, a change under `apps/web/`, `packages/api/` or `packages/domain/` adds the browser journey, and a change to the harness itself (`turbo.json`, the root manifest, the lockfile, `packages/config`, `packages/tooling`, or a workflow) falls back to the full suite. `verify:changed` is a fast local filter, never the handoff gate.

Run `pnpm bootstrap` before the integration and browser levels; run `pnpm diagnose` when one of them fails for an environmental reason.

Integration tests use Testcontainers and do not touch the development database. They start PostgreSQL, apply every committed migration with `prisma migrate deploy`, run tests, and destroy the container.

Playwright starts the Next.js development server locally. Under `CI=true`, it starts the existing production build. Install its browser once with `pnpm exec playwright install chromium`.

## Native evidence

`pnpm verify` does not run Maestro, because a native journey needs an app build and a simulator that a GitHub-hosted runner does not have. The suite still carries three levels of native evidence:

- `test:unit` runs the Jest/RNTL component suites.
- `typecheck` covers the Expo app against the same shared API and domain contracts as web.
- `build` runs `expo export --platform all`, so a bundle that no longer resolves or compiles fails the authoritative suite.

What is missing is the on-device journey. Run it locally against a simulator with `pnpm test:e2e:mobile`, and add an EAS Workflow once the product is connected to an Expo project with credentials. Do not substitute a browser run of React Native Web for it: that exercises a renderer the product does not ship, so it would report confidence the native build has not earned.

## Choosing a level

- Put pure business examples beside `packages/domain` code.
- Use component tests for behavior a user can observe without a full app.
- Use database integration tests for constraints, queries, migrations, locking, and transactions.
- Reserve Playwright/Maestro for a small number of revenue-, auth-, or data-critical journeys.
- Test an external integration with contract fixtures plus a thin sandbox test when the provider offers one.

Every bug fix should first demonstrate the failure at the lowest level that faithfully reproduces it.

## Evidence workflow

1. Run the closest relevant test before editing to establish a trustworthy baseline.
2. Add or change an executable example and observe it fail for the expected reason when practical.
3. Implement the smallest change that makes it pass.
4. Run the focused test during iteration, then the wider affected suite.
5. Inspect the diff for test weakening, skipped cases, broad mocks, unsafe casts, and unrelated changes.
6. Exercise the real interface for user-visible or integration behavior; use browser/native automation when repeatable.

Passing tests are evidence, not permission to ignore the rest of the system. Type checks cannot prove runtime parsing, authorization, persistence, accessibility, or provider behavior. A mocked unit cannot prove a database constraint or integration contract. Match evidence to the risk and report exactly what ran.

Tests must not be deleted, skipped, weakened, or rewritten merely because the implementation fails them. Change an existing expectation only when the product contract intentionally changed, and document that change in the same commit.
