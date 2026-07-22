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

## Start locally

Requirements: Node.js 24, pnpm 10, and Docker or Podman.

```bash
pnpm install
cp apps/web/.env.example apps/web/.env
./start-database.sh
pnpm db:migrate
pnpm dev
```

`start-database.sh` creates or starts a local PostgreSQL container; Prisma itself does not require a separate local installation. `pnpm dev` starts web. Use `pnpm dev:mobile` for Expo or `pnpm dev:all` for both. On a physical device, set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` to the development machine's LAN URL.

OAuth and Sentry are optional. Copy the relevant values from the environment examples when the product needs them. Never commit the resulting `.env` files.

## Verify

```bash
pnpm format:check
pnpm check
pnpm test:integration
pnpm build
pnpm test:e2e
```

See `AGENTS.md` for the binding agent contract and `docs/README.md` for the repository knowledge map. The ranked hard rules live in `docs/engineering-principles.md`; architecture, verification, and their research basis stay in separate progressively loaded documents.

Codex and compatible tools load `AGENTS.md` directly. Thin pointer files also route Claude Code, Gemini CLI, Cursor, and GitHub Copilot to that same source of truth without duplicating instructions.

After creating a GitHub remote, protect `main` and enable Dependabot alerts, secret scanning, push protection, and private vulnerability reporting. The workflows and Dependabot/CodeQL configuration are already checked in.
