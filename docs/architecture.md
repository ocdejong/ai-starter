# Architecture

## Dependency direction

```text
apps/mobile ──> packages/api/client (types only)

apps/web ─────> packages/api ──────> packages/domain
    │                 ↑                       ↑
    │                 └── injects consumer-owned ports
    ├─────────────────────────────────────────┘  non-tRPC route handlers parse with domain schemas
    └─────────> packages/db ───────> PostgreSQL

apps/web + apps/mobile ──> packages/tokens, packages/i18n
all workspaces ──────────> packages/config (tooling only)
```

| Layer    | May contain                                                                    | Must not contain                                 |
| -------- | ------------------------------------------------------------------------------ | ------------------------------------------------ |
| `domain` | Zod schemas, value objects, deterministic rules                                | React, Next.js, Expo, Prisma, environment reads  |
| `tokens` | Plain colors, spacing, typography values                                       | Components, runtime/platform imports             |
| `i18n`   | ICU message catalogs, `Locale` schema, locale negotiation                      | Components, framework or platform imports        |
| `db`     | Prisma client, schema, migrations, persistence adapters                        | Client code, web framework adapters, API routing |
| `api`    | tRPC, authorization, use cases, consumer-owned ports                           | Prisma/service SDKs, Next.js/Expo UI             |
| `web`    | App Router, UI, Better Auth, transport/composition root, AI SDK route handlers | Direct database access from UI/transport folders |
| `mobile` | Expo Router, native UI, typed API client                                       | Prisma, Next.js, server API implementation       |

ESLint import restrictions enforce the most important boundaries per file. `pnpm arch` runs dependency-cruiser (`.dependency-cruiser.cjs`) over the whole graph to enforce this direction and forbid cycles and deep imports into a package's internals; `pnpm policy` enforces the structural rules the graph cannot see (workspace dependency allowlists, public export surfaces, strict compiler flags in every tsconfig, vendor SDK locations, silenced guardrails, generated-client cleanliness, and the verification scripts). Both run inside `pnpm verify`. The database package also imports `server-only`, providing a runtime/build-time backstop.

## Domain-driven structure and dependency inversion

Organize new business behavior around bounded contexts and product language, not framework primitives. A context owns its vocabulary, schemas, invariants, policies, and use cases. Do not create one generic service/repository layer shared by unrelated domains.

Use a functional core with an imperative shell:

```text
transport/UI → application use case → domain rules
                         ↓
               consumer-owned port
                         ↓
                infrastructure adapter
```

- Domain functions are deterministic and accept values explicitly.
- A use case coordinates a single business outcome and depends on the smallest capability contract it consumes.
- Prisma, provider SDKs, clocks, randomness, queues, email, files, and network calls live behind adapters.
- The web server composition root constructs concrete adapters and injects them into API/application code.
- Transport handlers translate protocol concerns; they do not contain business rules or expose Prisma/vendor models as public contracts.

An interface is not automatically good architecture. Add one only at a real side-effect or volatility boundary, for a genuine substitution/test seam, or after proven duplication. Prefer a direct function for stable pure behavior. Keep contract methods use-case-shaped rather than mirroring an SDK or exposing generic CRUD.

Cross-context communication goes through an explicit public contract. Never reach into another context's internal files, database tables, or adapter implementation. If a feature forces reverse or circular dependencies, redesign the ownership or introduce an event/port at the boundary rather than adding an import exception.

## Data and validation

The intended path is:

```text
input → Zod → tRPC adapter → domain/use case → port → Prisma adapter/transaction → PostgreSQL constraint
```

Zod provides runtime validation and inferred TypeScript types. It does not replace database integrity. Required data uses `NOT NULL`; ownership uses foreign keys; identities use unique constraints; row-level invariants use CHECK constraints; related writes use a transaction. Integration tests apply migrations to a real ephemeral PostgreSQL instance and prove those rules independently of TypeScript.

For forms, use the same domain schema on web and mobile. Add React Hook Form plus the Zod resolver when a real form exists; do not introduce a form abstraction pre-emptively. tRPC `.input(schema)` is the server request boundary. Validate responses from external APIs before domain code consumes them.

Parse external data once at the edge and pass trusted domain values inward. Do not repeatedly validate the same object or scatter defensive optional chaining through trusted code. Domain types must not be aliases of Prisma-generated or provider SDK types.

## Server and client state

TanStack Query, through the tRPC adapters, owns remote/server state: fetching, caching, invalidation, retries, and optimistic updates. Keep ephemeral UI state local with React state. Use URL state on web when it should be linkable. Add a global client store such as Zustand only for genuinely client-only state shared across distant screens; never duplicate server records into it.

## Authentication and OAuth

Better Auth is the server authority and Prisma persists its users, sessions, and accounts. Google is preferred when configured; GitHub is a fallback. Provider credentials are optional so the starter builds before a product chooses its login method.

Keep sign-in and external-service authorization conceptually separate. Initial login should request identity only. Request calendar access later with Better Auth's account-linking flow and the narrowest scopes; Google offline access is configured so an approved integration can receive refresh tokens. A mobile-native Google flow must use the platform client IDs and exchange the resulting ID token with Better Auth—it should not copy a web cookie flow blindly.

## UI sharing

The web uses Tailwind CSS and shadcn components in `apps/web/src/components/ui`. Native uses React Native primitives. `packages/tokens` is the shared visual vocabulary. This avoids brittle attempts to make DOM components run natively while preserving consistent colors and spacing.

## Optional integrations

Sentry initializes on Next.js and Expo only when a DSN exists. Build-time org/project/token variables enable source maps. Other external services—email, AI providers, payments, calendars—should enter through server-side adapters with typed configuration, timeouts, error translation, Zod response parsing, idempotency where relevant, and tests at the adapter boundary.

An adapter must expose a narrow product-oriented contract and keep vendor request/response types private. Centralize retries, rate-limit handling, idempotency, observability, and error translation there. Keep authorization visible at the use-case or procedure boundary; never rely on an implicit UI check.

Realtime AI chat streams from a server route (SSE/streamed HTTP by default; WebSockets only when bidirectional realtime is required), not through tRPC — `useChat` speaks the UI message stream protocol and tRPC streams its own envelope. `apps/web/src/app/api/chat/route.ts` is the composition root for that seam and `getChatModel()` in `apps/web/src/server/ai.ts` is the only place a model or vendor is chosen; `LanguageModel` is already provider-neutral, so nothing wraps `streamText`. Guard every turn in order: session, then the shared wire contract in `packages/domain`, then a per-user rate limit. Never expose model/provider secrets to either client, and never log prompts, completions, or provider payloads.

The starter's example chat keeps history ephemeral on purpose — nothing is persisted, so the example stays a vertical slice rather than a schema decision made on a product's behalf. A product that needs history persists final messages and important tool results while keeping transport chunks ephemeral.
