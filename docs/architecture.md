# Architecture

## Dependency direction

```text
apps/mobile ──> packages/api/client (types only)

apps/web ─────> packages/api ──────> packages/domain
    │                 ↑                       ↑
    │                 └── injects consumer-owned ports
    ├─────────────────────────────────────────┘  route handlers and forms parse with domain schemas
    └─────────> packages/db ───────> PostgreSQL

apps/web + apps/mobile ──> packages/domain, packages/tokens, packages/i18n
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

ESLint import restrictions enforce the most important boundaries per file. `pnpm arch` runs dependency-cruiser (`.dependency-cruiser.cjs`) over the whole graph to enforce this direction and forbid cycles and deep imports into a package's internals; `pnpm policy` enforces the structural rules the graph cannot see (workspace dependency allowlists, public export surfaces, strict compiler flags in every tsconfig, vendor SDK locations, silenced guardrails, generated-client cleanliness, untranslated copy, and the verification scripts). `pnpm knip` answers the question neither of them asks — which files, exports and dependencies nothing reaches at all — because a slice replaced rather than removed still compiles, lints and passes its own tests. All three run inside `pnpm verify`; `knip.config.js` records every entry point Knip cannot infer and every dependency reached through something other than an import. The database package also imports `server-only`, providing a runtime/build-time backstop.

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

## The golden path

A feature slice has one shape in this repository, and `pnpm generate feature` emits it: a Zod contract and its invariants in `packages/domain` reporting stable codes an interface translates, a consumer-owned port in `packages/api`, a `groupProcedure` router that takes no group identifier, a Prisma adapter in `packages/db` whose multi-write operation is one transaction, constraints in PostgreSQL that the application cannot write around, and web and native screens over layered tests. The committed `announcement` slice is that generator's output and is kept so by a drift test, so it is the worked example to read; the generator is the thing to run.

Two obligations follow a generated feature and the command prints both. Prisma cannot express a partial index or a CHECK constraint, so the migration is created with `--create-only` and its SQL is finished by hand. And a generator cannot translate a product's own noun, so both catalogs receive the same English copy and the Dutch one is a translation task rather than a missing one. Neither obligation rests on somebody reading the printout: the migration fails `pnpm db:lint` until it carries its timeouts, and `pnpm policy` reports every Dutch message still identical to its English one until it is translated.

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

Each platform has one place a session is required. On web that is the `(app)` route group's layout, which calls `requireSession()`, so a page added under it cannot forget the check; the `(auth)` group's layout owns the other direction, and `apps/web/src/lib/routes.ts` names both destinations once. Never authorize in middleware, which only sees an optimistic cookie. On native the root layout's session gate owns the same decision through the pure `resolveAuthRedirect`, with the `(app)` tab group behind it — and a screen inside still renders defensively for a missing session, because the gate corrects the route one frame later.

A session token is a bearer credential and is treated as one. The account settings page reads the session list on the server, renders a projection that carries no token, and revokes by session id through a server action that resolves the id back to a token against the caller's own list — so an injected script cannot read every device's credential out of the page, and an id belonging to another account resolves to nothing. Native reads the same list in the client, where that exposure does not exist and the app already holds its own token in the keychain. Better Auth's session-freshness window is disabled deliberately (`packages/auth/src/init-auth.ts` records why): it gates only the session listing and account unlinking, while the destructive half of the same screen is not gated at all.

Groups are Better Auth organizations behind the product word "group", and there are two paths to them on purpose. Product code scopes its own queries with `groupProcedure`, which takes no group identifier from the caller and re-derives the membership behind the session's active group on every call — that is the path a feature slice uses, and every group-scoped query filters by `ctx.group.groupId`. The group chrome itself — the switcher, the settings section, the invitation page — reads and writes through the organization client instead, because the plugin owns the stores those screens render and because `setActive` writes the very cookie the tRPC context reads; routing that through a second cache would mean maintaining a second invalidation protocol for the same rows. Neither path lets the interface name a group it was not already working in. Which affordances render comes from `checkRolePermission`, which answers from the same access-control definition the server enforces with, never from a hand-written role comparison — and the server refuses regardless, which is what the adversarial browser journey asserts. A group always has an owner: its last owner can neither leave, be removed, nor be demoted, so the exits are handing ownership over or deleting the group, and both leave the session without an active group until the client re-points it.

Keep sign-in and external-service authorization conceptually separate. Initial login should request identity only. Request calendar access later with Better Auth's account-linking flow and the narrowest scopes; Google offline access is configured so an approved integration can receive refresh tokens. A mobile-native Google flow must use the platform client IDs and exchange the resulting ID token with Better Auth—it should not copy a web cookie flow blindly.

## UI sharing

The web uses Tailwind CSS and shadcn components in `apps/web/src/components/ui`. Native uses React Native primitives. `packages/tokens` is the shared visual vocabulary. This avoids brittle attempts to make DOM components run natively while preserving consistent colors and spacing.

## Optional integrations

Sentry initializes on Next.js and Expo only when a DSN exists. Build-time org/project/token variables enable source maps. Other external services—email, AI providers, payments, calendars—should enter through server-side adapters with typed configuration, timeouts, error translation, Zod response parsing, idempotency where relevant, and tests at the adapter boundary.

An adapter must expose a narrow product-oriented contract and keep vendor request/response types private. Centralize retries, rate-limit handling, idempotency, observability, and error translation there. Keep authorization visible at the use-case or procedure boundary; never rely on an implicit UI check.

Realtime AI chat streams from a server route (SSE/streamed HTTP by default; WebSockets only when bidirectional realtime is required), not through tRPC — `useChat` speaks the UI message stream protocol and tRPC streams its own envelope. `apps/web/src/app/api/chat/route.ts` is the composition root for that seam and `getChatModel()` in `apps/web/src/server/ai.ts` is the only place a model or vendor is chosen; `LanguageModel` is already provider-neutral, so nothing wraps `streamText`. Guard every turn in order: session, then the shared wire contract in `packages/domain`, then a per-user rate limit. Never expose model/provider secrets to either client, and never log prompts, completions, or provider payloads.

Both platforms talk to that one route. The native transport is `apps/mobile/src/chat/transport.ts`: it targets `EXPO_PUBLIC_API_URL` — the same origin the tRPC client uses, because the session cookie is only valid for one — attaches that cookie per request since React Native has no cookie jar, and passes `expo/fetch`, whose response streams where the platform's own `fetch` buffers. Anything a native client cannot know for itself it learns from the server's answer rather than from a shipped copy of the configuration: an unconfigured deployment is recognised from the `chat_not_configured` refusal, not from a mobile environment variable.

The starter's example chat keeps history ephemeral on purpose — nothing is persisted, so the example stays a vertical slice rather than a schema decision made on a product's behalf. A product that needs history persists final messages and important tool results while keeping transport chunks ephemeral.

## Entropy

Four kinds of drift are gradual enough that no single change looks wrong, so each is a check rather than a convention.

`pnpm knip` reports what nothing reaches. `pnpm policy` carries a ratchet over the two suppressions that cannot be banned without lying — a `@ts-expect-error` that documents a genuine upstream defect and an `eslint-disable` that carries a reason — against a list in `packages/tooling/src/suppression-ratchet.ts` that may only shrink, in both directions: removing a suppression without lowering the number leaves a budget nobody spent. Everything that _can_ be banned already is, so a skipped test, a focused one, a laundered assertion and an undescribed directive fail outright rather than counting against a budget.

Copy drifts the same way, one honest omission at a time. The catalogs are checked for the same keys, the same ICU arguments, no duplicates and no empty values — all four compare structure, so a Dutch catalog holding the English sentences passes every one of them, which is exactly what `pnpm generate feature` writes and what a cold agent left behind. So `pnpm policy` compares the values too: a message identical to the English one is untranslated until an entry in `packages/tooling/src/translation-policy.ts` says why, and that list may only shrink. Sixteen entries earn it today — product names, endonyms, and the loanwords Dutch software genuinely uses. Two limits are worth knowing: exact equality is the whole test, so a translation that differs by a comma passes, and this finds copy that was never translated rather than copy that is wrong. A catalog key nothing renders is a third kind of drift and is deliberately _not_ checked — the session rows build `…sessions.browser.chrome` from a parsed user-agent, so a checker looking for each leaf as a literal would need an allowlist on the day it landed.

The rest of the drift lives outside the checkout, in what the repository produces and what the world does to it, and is covered by the scheduled sensors in `docs/testing.md`.
