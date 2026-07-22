# Architecture

## Dependency direction

```text
apps/web ─────┐
              ├──> packages/api ──> packages/domain
apps/mobile ──┘          │
                        └──> packages/db ──> PostgreSQL

apps/web + apps/mobile ──> packages/tokens
all workspaces ──────────> packages/config (tooling only)
```

| Layer    | May contain                                         | Must not contain                                      |
| -------- | --------------------------------------------------- | ----------------------------------------------------- |
| `domain` | Zod schemas, value objects, deterministic rules     | React, Next.js, Expo, Prisma, environment reads       |
| `tokens` | Plain colors, spacing, typography values            | Components, runtime/platform imports                  |
| `db`     | Prisma client, schema, migrations                   | Client code, framework adapters, API routing          |
| `api`    | tRPC routers, authorization, orchestration          | Next.js/Expo UI or framework-specific request objects |
| `web`    | App Router, shadcn UI, Better Auth, server adapters | Direct database access from UI/transport folders      |
| `mobile` | Expo Router, native UI, typed API client            | Prisma, Next.js, server API implementation            |

ESLint import restrictions enforce the most important boundaries. The database package also imports `server-only`, providing a runtime/build-time backstop.

## Data and validation

The intended path is:

```text
form/native input → shared Zod schema → tRPC procedure → domain rule → Prisma transaction → PostgreSQL constraint
```

Zod provides runtime validation and inferred TypeScript types. It does not replace database integrity. Required data uses `NOT NULL`; ownership uses foreign keys; identities use unique constraints; row-level invariants use CHECK constraints; related writes use a transaction. Integration tests apply migrations to a real ephemeral PostgreSQL instance and prove those rules independently of TypeScript.

For forms, use the same domain schema on web and mobile. Add React Hook Form plus the Zod resolver when a real form exists; do not introduce a form abstraction pre-emptively. tRPC `.input(schema)` is the server request boundary. Validate responses from external APIs before domain code consumes them.

## Server and client state

TanStack Query, through the tRPC adapters, owns remote/server state: fetching, caching, invalidation, retries, and optimistic updates. Keep ephemeral UI state local with React state. Use URL state on web when it should be linkable. Add a global client store such as Zustand only for genuinely client-only state shared across distant screens; never duplicate server records into it.

## Authentication and OAuth

Better Auth is the server authority and Prisma persists its users, sessions, and accounts. Google is preferred when configured; GitHub is a fallback. Provider credentials are optional so the starter builds before a product chooses its login method.

Keep sign-in and external-service authorization conceptually separate. Initial login should request identity only. Request calendar access later with Better Auth's account-linking flow and the narrowest scopes; Google offline access is configured so an approved integration can receive refresh tokens. A mobile-native Google flow must use the platform client IDs and exchange the resulting ID token with Better Auth—it should not copy a web cookie flow blindly.

## UI sharing

The web uses Tailwind CSS and shadcn components in `apps/web/src/components/ui`. Native uses React Native primitives. `packages/tokens` is the shared visual vocabulary. This avoids brittle attempts to make DOM components run natively while preserving consistent colors and spacing.

## Optional integrations

Sentry initializes on Next.js and Expo only when a DSN exists. Build-time org/project/token variables enable source maps. Other external services—email, AI providers, payments, calendars—should enter through server-side adapters with typed configuration, timeouts, error translation, Zod response parsing, idempotency where relevant, and tests at the adapter boundary.

Realtime AI chat should stream from a server route (SSE/streamed HTTP by default; WebSockets only when bidirectional realtime is required). Persist final messages and important tool results, but keep transport chunks ephemeral. Never expose model/provider secrets to either client.
