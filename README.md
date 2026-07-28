# AI-first full-stack starter

A strongly typed pnpm/Turborepo starter for a Next.js web app and Expo mobile app. It keeps the productive T3 path—Prisma → tRPC → TanStack Query → component—while enforcing runtime validation, database integrity, client/server boundaries, and cross-platform tests.

## Stack

- Next.js App Router, React, Tailwind CSS, and shadcn/ui
- Expo Router and React Native
- Better Auth: email and password, with the server half of Google/GitHub OAuth configured but no sign-in button on either platform yet
- tRPC, TanStack Query, Zod, Prisma, and PostgreSQL
- strict TypeScript; flat, type-aware ESLint; Prettier
- Vitest/Testing Library, Jest/RNTL, Testcontainers, Playwright, and Maestro
- GitHub Actions, Dependabot, CodeQL, and optional Sentry

```text
apps/
  web/       Next.js, Better Auth, web UI, and HTTP adapters
  mobile/    Expo Router, native UI, and the typed API client
packages/
  api/       tRPC routers and client-safe AppRouter types
  domain/    shared Zod schemas and platform-neutral business logic
  db/        server-only Prisma client, migrations, and integration tests
  auth/      Better Auth factory: account, group, and session flows
  email/     react-email templates, Resend and dev-mailbox adapters
  config/    shared TypeScript, ESLint, and Vitest configuration
  i18n/      shared EN/NL message catalogs and locale negotiation
  tokens/    platform-neutral design tokens
  tooling/   every `pnpm` command in this README
```

## What you already have

A new product does not start at a sign-in form. Working on web **and** native, in
English and Dutch, in light and dark:

- Register, verify the address by email, sign in, forgot and reset password.
- A dashboard behind a session guard, hosting a streaming LLM chat.
- Groups: a personal one per account, invitations by email, roles, and settings.
- Account settings: profile, change email, change password, active sessions, delete account.
- An `announcement` slice that is the feature generator's own output, kept so by a test — and removable with one command when you want your own instead.

Everything above is yours to change. Nothing in it is a demo behind a flag.

Vendors are optional and degrade honestly: with no Resend key email is written to
a local mailbox, and with no model key the chat renders its "not configured"
state. A clone with no keys at all boots, signs in and passes `pnpm verify`.

## Create a product from this template

Requirements: Node.js 24 or 26+ (25 is not supported — dependency-cruiser refuses
non-LTS majors), pnpm 10, and Docker or Podman.

```bash
pnpm starter:init --name "Acme Notes"
pnpm bootstrap
pnpm verify
```

Expect under five minutes from clone to a green suite on an unloaded laptop, and
around ten on a cold CI runner. Those are the two figures `pnpm rehearse:template`
measures, and it does strictly more than the three commands above — it also runs
every generator and applies a migration. The clone itself is seconds,
`starter:init` and `bootstrap` about a minute each, and `pnpm verify` is the rest.
Measure on a quiet machine: a laptop already running other suites and database
containers stretched the same `verify` several times over.

`starter:init` runs once in a fresh clone. It replaces every starter identifier — the workspace package scope, the repository, database and container names, the Expo name, slug and scheme, the iOS bundle identifier, the Android package, and the visible starter text — and then fails if any starter identity survives, including in a file name. It also hands this README over: the title becomes the product's, and this section goes, because a product's front door should not tell its owner to create the product. It finishes by relinking the workspace and reformatting: the new identifiers have different lengths, so Prettier wraps a few files differently.

| Option     | Default              | Purpose                                       |
| ---------- | -------------------- | --------------------------------------------- |
| `--name`   | required             | Display name; everything else derives from it |
| `--scope`  | slug of `--name`     | npm scope for workspace packages              |
| `--app-id` | `com.example.<slug>` | iOS bundle identifier and Android package     |

`packages/tooling/src/starter-identity.ts` is deliberately left untouched: it stays the record of what was replaced.

## Start locally

```bash
pnpm bootstrap
pnpm dev
```

`bootstrap` creates the environment files, installs dependencies, starts a local PostgreSQL container, generates the Prisma client, applies every migration, and seeds a demo account so the app can be signed into immediately: `demo@example.com` with password `demo-password`. It is idempotent, so run it again whenever a checkout drifts. `pnpm db:seed` re-runs the seed alone; because the demo credentials are public documentation, it refuses any database that is not local. When the configured database port is already taken, the generated `apps/web/.env` moves to the next free port; a linked git worktree instead derives its database port and web origin from its own path, because a free-port probe cannot see a stopped sibling container or a bootstrap racing in another worktree. The container is named after the database and the chosen port (`ai-starter-postgres-5433`), so parallel checkouts — sibling git worktrees included — each keep their own database, container and dev-server origin.

Run `pnpm diagnose` when something does not work: it reports Node, pnpm, the container runtime, the environment files, PostgreSQL and the generated Prisma client, and names the command that fixes each problem. The command is `diagnose` rather than `doctor` because pnpm reserves `doctor` for a built-in that would silently shadow it.

`pnpm dev` starts web. Use `pnpm dev:mobile` for Expo or `pnpm dev:all` for both. On a physical device, set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` to the development machine's LAN URL.

OAuth and Sentry are optional. Copy the relevant values from the environment examples when the product needs them. Never commit the resulting `.env` files.

## Add a feature

```bash
pnpm generate feature reminder --shape list  # the whole vertical slice
pnpm generate context pricing-tier           # the domain half alone
pnpm generate adapter sms-sender             # a port and a vendor-free adapter
pnpm generate feature --remove reminder      # and the way back out
```

A generated feature arrives in the product's own words and already registered everywhere it has to be: the domain export, the API port and router, the composition root, the Prisma model, both message catalogs, and the navigation on web and native. It is expected to pass `pnpm verify:changed` once you have done the follow-ups the command prints — the two things it cannot do for you: writing the migration's hand-written SQL, and translating the Dutch copy it wrote in English, which `pnpm policy` reports as untranslated until you do.

`--shape` is required and has no default, because how your records relate to each other is not something a generator can guess. `current` gives you one record per group with the earlier ones superseded; `list` gives you records that accumulate. You pick it once, at the command, instead of discovering later that your chore board says "Publishing supersedes the current chore".

The `announcement` slice in this repository is that generator's output and a test keeps it so, which makes it the worked example to read. A product that does not want it runs `pnpm generate feature --remove announcement`, which deletes its files and takes every registration back out. `pnpm generate feature announcement --shape current` writes the slice again — as _your_ feature, not as the pinned example: the drift test only holds slices this repository guarantees it has not touched, and yours is one you are about to edit.

## Verify

```bash
pnpm verify:changed   # only the checks the current diff can affect
pnpm verify           # the complete authoritative suite, in CI's order
```

`pnpm verify` is the single source of truth for what "green" means; CI runs the same command. `verify:changed` uses Turborepo's affected graph, plus explicit rules for evidence the graph cannot infer: a Prisma schema or migration change adds the real-PostgreSQL tests, and web-observable behavior adds the browser journey. A change to the harness itself falls back to the full suite.

See `AGENTS.md` for the binding agent contract and `docs/README.md` for the repository knowledge map. The ranked hard rules live in `docs/engineering-principles.md`; architecture, verification, and their research basis stay in separate progressively loaded documents.

Codex and compatible tools load `AGENTS.md` directly. Thin pointer files also route Claude Code, Gemini CLI, Cursor, and GitHub Copilot to that same source of truth without duplicating instructions.

After creating a GitHub remote, run `pnpm repo:host`. It applies the checked-in branch ruleset and turns on Dependabot alerts, secret scanning, push protection and private vulnerability reporting — reading the host first and sending only the difference, so it is safe to re-run. `--dry-run` prints the plan instead. The workflows and the Dependabot/CodeQL configuration are already checked in; `docs/repository-host.md` explains what each setting buys. The one thing it cannot do for you is `.github/CODEOWNERS`, which still names this template's author.
