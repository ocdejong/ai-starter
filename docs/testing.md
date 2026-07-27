# Testing

## Commands

| Command                 | Purpose                                                          | Prerequisite                                     |
| ----------------------- | ---------------------------------------------------------------- | ------------------------------------------------ |
| `pnpm verify`           | The complete authoritative suite, in CI's order                  | A bootstrapped environment                       |
| `pnpm verify:changed`   | Only the checks the current diff can affect                      | A git checkout with a resolvable base revision   |
| `pnpm test:unit`        | Domain, web component, and native component suites               | Dependencies installed                           |
| `pnpm test:integration` | Prisma migrations and integrity against PostgreSQL               | Docker/Podman running                            |
| `pnpm test:e2e`         | Playwright Chromium web journey                                  | Local database running and migrated              |
| `pnpm test:e2e:mobile`  | Maestro native smoke flow; skips with a reason without a device  | Maestro plus an installed simulator/device build |
| `pnpm db:lint`          | Squawk over migration SQL a running database would have to take  | Dependencies installed                           |
| `pnpm mutation`         | Stryker over `domain` and `api`; scheduled, not part of `verify` | Dependencies installed                           |
| `pnpm check`            | Lint, typecheck, and unit/component tests                        | Dependencies installed                           |
| `pnpm instructions`     | Agent instruction surfaces and document references               | A git checkout                                   |
| `pnpm arch`             | Dependency direction, cycles, and deep imports across the graph  | Dependencies installed                           |
| `pnpm policy`           | Structural rules the module graph cannot see                     | Dependencies installed                           |
| `pnpm knip`             | Files, exports and dependencies nothing in the graph reaches     | Dependencies installed                           |

`packages/tooling/src/verification.ts` holds the one ordered definition of the authoritative suite. `pnpm verify`, `pnpm verify:changed` and the CI workflow all read it, so the required checks cannot drift apart. Adding a check means adding it there.

`pnpm verify:changed` always runs `pnpm arch`, `pnpm policy` and `pnpm knip` alongside formatting, because any change can shift the dependency graph or the repository structure — and deleting the last caller of an export orphans it in a package the diff never named. On top of that it selects work from Turborepo's affected graph — `--filter=...[base]` reaches every dependent, so a change to `packages/domain` typechecks and unit-tests the API, both apps and the email package — plus the rules the graph cannot infer from imports:

- a change under `packages/db/prisma/` adds schema validation, migration linting, client regeneration ahead of the affected typecheck, and the real-PostgreSQL tests;
- a change under `packages/auth/` or `packages/db/` adds the real-PostgreSQL tests on its own;
- a change under `apps/web/`, `packages/api/`, `packages/auth/`, `packages/db/`, `packages/domain/`, `packages/email/` or `packages/i18n/` adds the browser journey — the journeys sign up through the real auth server, click a link an email template rendered, and assert copy a catalog supplies, so each of those can break one while every unit suite stays green;
- a change under `apps/mobile/` or `packages/i18n/` adds the native journey;
- a change to an instruction surface or a documentation file rechecks the instruction policy;
- a change to the harness itself (`turbo.json`, the root manifest, the lockfile, `packages/config`, `packages/tooling`, or a workflow) falls back to the full suite.

`packages/tokens/` is deliberately absent from the journey rules: it reaches the browser as colours no journey asserts, and the generated stylesheet is kept honest by a unit test. `verify:changed` is a fast local filter, never the handoff gate.

`packages/tooling/src/change-selection.test.ts` pins one representative diff per class — migration, web page, native screen, native flow, domain schema, email template, i18n catalog, auth flow, design tokens — asserting the whole selection rather than only what it contains, because an over-selection is the reason someone stops running the command at all.

Run `pnpm bootstrap` before the integration and browser levels; run `pnpm diagnose` when one of them fails for an environmental reason.

Integration tests use Testcontainers and do not touch the development database. They start PostgreSQL, apply every committed migration with `prisma migrate deploy`, run tests, and destroy the container.

Playwright starts the Next.js development server locally. Under `CI=true`, it starts the existing production build. Install its browser once with `pnpm exec playwright install chromium`.

It serves and drives the origin `.env`'s own `BETTER_AUTH_URL` names — `pnpm bootstrap` derives a distinct one for every git worktree, and `pnpm dev` binds the same port — falling back to `http://localhost:3000` when neither is set. That default is what lets sibling checkouts run the browser level at once instead of one reusing — and silently asserting against — the other's dev server. `E2E_BASE_URL` still overrides the origin and the port the started server listens on; override it together with `BETTER_AUTH_URL`: the auth server builds emailed action links from that variable, and a session cookie set on one origin is invisible to another, so the journey that follows a confirmation link only works when the two agree.

Journeys share `apps/web/e2e/support/`: `apps/web/e2e/support/mailbox.ts` reads the dev mailbox the way a person reads their inbox, and `apps/web/e2e/support/account.ts` registers an account and confirms it, which is how a spec that is about something else arrives signed in. The dashboard journey stubs `POST /api/chat` in the browser with a hand-written UI message stream, so it proves the composer, the transport and the transcript without spending a provider token or depending on what a model happens to say. Because the stub answers instead of the handler, the route callback also parses the intercepted body with the shared `chatRequestSchema` — otherwise nothing would prove that what the transport builds is what the server accepts, and the first request against a configured deployment would be the test. The model factory still needs a key at process start, which `apps/web/playwright.config.ts` supplies. Never point a journey at a real provider — the assertion would be probabilistic and the run would cost money.

## Native evidence

`pnpm verify` ends with `test:e2e:mobile`, and on a GitHub-hosted runner that step skips: a native journey needs an app build and a simulator neither the runner nor a Mac carrying only the command-line tools has. It says so rather than passing quietly, and `NATIVE_JOURNEY=required` turns the skip into a failure for a lane that does have a device.

A step that skips is a file nobody reads, which is how `apps/mobile/.maestro/smoke.yaml` came to assert a screen that had been unreachable for two stages. So `pnpm policy` checks the flow wherever it runs: the `appId` must be the identifier this app installs as, every message the flow asserts or taps must be one `packages/i18n/messages/en.json` actually carries, and a flow that asserts nothing at all is rejected. That catches copy drift, which is the common case; it cannot catch a screen becoming unreachable, which only a device can.

Beyond that, the suite carries three levels of native evidence:

- `test:unit` runs the Jest/RNTL component suites. A screen file under `apps/mobile/src/app/` cannot hold its own test — expo-router would register the test as a route — so the testable component lives in `src/components/` and the route file only wires it up. ESM-only dependencies need their package added to the `transformIgnorePatterns` allowlist in `apps/mobile/package.json`; pnpm's nested `node_modules` segment re-triggers the pattern, and a `.mjs` entry point cannot be transformed at all, in which case mock the module boundary instead.
- `typecheck` covers the Expo app against the same shared API and domain contracts as web.
- `build` runs `expo export --platform all`, so a bundle that no longer resolves or compiles fails the authoritative suite.

What is still missing is the on-device run itself. Install Maestro and boot a simulator to get it locally, and add an EAS Workflow once the product is connected to an Expo project with credentials — then set `NATIVE_JOURNEY=required` there so that lane cannot go quiet. Do not substitute a browser run of React Native Web for it: that exercises a renderer the product does not ship, so it would report confidence the native build has not earned.

## Coverage and mutation

`packages/domain` and `packages/api` run their unit tests with a coverage floor, set in `packages/domain/vitest.config.ts` and `packages/api/vitest.config.ts` through `coveredVitestConfig`. The floor is the level the package already holds — 100% for `domain`, whose rules are pure and reachable from any test — so it cannot be satisfied by code nobody exercises, and the only way to fail it is to add some. Coverage counts the whole source tree, not only the files a test happened to import: without that, an untested module counts for nothing and a package can lose coverage by growing.

Coverage says a line ran. It does not say a test would have noticed had the line been wrong, and a suite can reach 100% while asserting almost nothing. `pnpm mutation` answers the second question: Stryker rewrites each statement — flipping a comparison, emptying an object, dropping a condition — and reports how many of those the tests killed. When this landed, `domain` was at 100% coverage and 89% mutation score; the 25 survivors are the honest measure of what the assertions miss.

It runs weekly through `.github/workflows/mutation.yml` and on request, never per edit: a full run is minutes of work for a signal that moves slowly. `packages/domain/stryker.config.json` and `packages/api/stryker.config.json` each carry a break threshold set to the score it already earns. Raise one when a test raises the measurement; never lower one to land a change.

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
