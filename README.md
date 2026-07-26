# AI-first full-stack starter

A strongly typed pnpm/Turborepo starter for a Next.js web app and Expo mobile app. It keeps the productive T3 path—Prisma → tRPC → TanStack Query → component—while enforcing runtime validation, database integrity, client/server boundaries, and cross-platform tests.

## Stack

- Next.js App Router, React, Tailwind CSS, and shadcn/ui
- Expo Router and React Native
- Better Auth with optional Google/GitHub OAuth
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
  config/    shared TypeScript, ESLint, and Vitest configuration
  tokens/    platform-neutral design tokens
```

## Create a product from this template

```bash
pnpm starter:init --name "Acme Notes"
pnpm bootstrap
pnpm verify
```

`starter:init` runs once in a fresh clone. It replaces every starter identifier — the workspace package scope, the repository, database and container names, the Expo name, slug and scheme, the iOS bundle identifier, the Android package, and the visible starter text — and then fails if any starter identity survives, including in a file name. It finishes by relinking the workspace and reformatting: the new identifiers have different lengths, so Prettier wraps a few files differently.

| Option     | Default              | Purpose                                       |
| ---------- | -------------------- | --------------------------------------------- |
| `--name`   | required             | Display name; everything else derives from it |
| `--scope`  | slug of `--name`     | npm scope for workspace packages              |
| `--app-id` | `com.example.<slug>` | iOS bundle identifier and Android package     |

`packages/tooling/src/starter-identity.ts` is deliberately left untouched: it stays the record of what was replaced.

## Start locally

Requirements: Node.js 24 or 26+ (25 is not supported — dependency-cruiser refuses non-LTS majors), pnpm 10, and Docker or Podman.

```bash
pnpm bootstrap
pnpm dev
```

`bootstrap` creates the environment files, installs dependencies, starts a local PostgreSQL container, generates the Prisma client, applies every migration, and seeds a demo account so the app can be signed into immediately: `demo@example.com` with password `demo-password`. It is idempotent, so run it again whenever a checkout drifts. `pnpm db:seed` re-runs the seed alone; because the demo credentials are public documentation, it refuses any database that is not local. When the configured database port is already taken, the generated `apps/web/.env` moves to the next free port; a linked git worktree instead derives its database port and web origin from its own path, because a free-port probe cannot see a stopped sibling container or a bootstrap racing in another worktree. The container is named after the database and the chosen port (`ai-starter-postgres-5433`), so parallel checkouts — sibling git worktrees included — each keep their own database, container and dev-server origin.

Run `pnpm diagnose` when something does not work: it reports Node, pnpm, the container runtime, the environment files, PostgreSQL and the generated Prisma client, and names the command that fixes each problem. The command is `diagnose` rather than `doctor` because pnpm reserves `doctor` for a built-in that would silently shadow it.

`pnpm dev` starts web. Use `pnpm dev:mobile` for Expo or `pnpm dev:all` for both. On a physical device, set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` to the development machine's LAN URL.

OAuth and Sentry are optional. Copy the relevant values from the environment examples when the product needs them. Never commit the resulting `.env` files.

## Verify

```bash
pnpm verify:changed   # only the checks the current diff can affect
pnpm verify           # the complete authoritative suite, in CI's order
```

`pnpm verify` is the single source of truth for what "green" means; CI runs the same command. `verify:changed` uses Turborepo's affected graph, plus explicit rules for evidence the graph cannot infer: a Prisma schema or migration change adds the real-PostgreSQL tests, and web-observable behavior adds the browser journey. A change to the harness itself falls back to the full suite.

See `AGENTS.md` for the binding agent contract and `docs/README.md` for the repository knowledge map. The ranked hard rules live in `docs/engineering-principles.md`; architecture, verification, and their research basis stay in separate progressively loaded documents.

Codex and compatible tools load `AGENTS.md` directly. Thin pointer files also route Claude Code, Gemini CLI, Cursor, and GitHub Copilot to that same source of truth without duplicating instructions.

After creating a GitHub remote, protect `main` and enable Dependabot alerts, secret scanning, push protection, and private vulnerability reporting. The workflows and Dependabot/CodeQL configuration are already checked in.
