# Testing

## Commands

| Command                 | Purpose                                            | Prerequisite                                     |
| ----------------------- | -------------------------------------------------- | ------------------------------------------------ |
| `pnpm test:unit`        | Domain, web component, and native component suites | Dependencies installed                           |
| `pnpm test:integration` | Prisma migrations and integrity against PostgreSQL | Docker/Podman running                            |
| `pnpm test:e2e`         | Playwright Chromium web journey                    | Local database running and migrated              |
| `pnpm test:e2e:mobile`  | Maestro native smoke flow                          | Maestro plus an installed simulator/device build |
| `pnpm check`            | Lint, typecheck, and unit/component tests          | Dependencies installed                           |

Integration tests use Testcontainers and do not touch the development database. They start PostgreSQL, apply every committed migration with `prisma migrate deploy`, run tests, and destroy the container.

Playwright starts the Next.js development server locally. Under `CI=true`, it starts the existing production build. Install its browser once with `pnpm exec playwright install chromium`.

The Maestro flow is checked in but not run by the default GitHub-hosted CI because it requires a native app build and simulator. Add an EAS Workflow when the starter is connected to an Expo project and credentials.

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
