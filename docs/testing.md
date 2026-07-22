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
