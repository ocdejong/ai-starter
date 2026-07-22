# Engineering principles

These are hard repository rules, ordered by importance. They supplement SOLID with the controls that matter when coding agents can generate changes faster than humans can review them. “The task was small,” “the code already worked,” and “the framework usually handles it” are not exemptions.

When rules conflict, prefer: security and data integrity → externally observable correctness → domain and architectural contracts → simplicity and maintainability → local consistency → delivery speed. Stop and record a decision when the right trade-off is not clear.

## Golden principles

### 1. Prove correctness; never declare it

Every completion claim MUST cite executable evidence appropriate to the risk: tests, type checks, builds, migrations, runtime inspection, or an end-to-end user journey. A plausible diff, passing types, or “this should work” is not proof. User-visible changes MUST be exercised through the real interface when practical.

### 2. Make architecture executable

Dependency direction and layer ownership are contracts, not suggestions. New dependencies MUST point inward according to `docs/architecture.md`. If a rule matters repeatedly, encode it in types, ESLint, a schema, a database constraint, or a test. Do not weaken a guardrail to land a change; fix the design or explicitly change the documented architecture.

### 3. Model the domain before the framework

Business language, invariants, schemas, value objects, and deterministic policies belong in `packages/domain`, organized by bounded context as the product grows. Domain code MUST remain independent of React, Next.js, Expo, tRPC, Prisma, environment variables, and transport shapes. Framework code adapts the domain; it does not define it.

### 4. Depend on contracts at side-effect boundaries

Business rules and use-case logic MUST NOT depend directly on a vendor SDK, global client, transport, clock, random generator, filesystem, or database implementation. Define the narrow contract the consuming use case needs; implement it in an adapter; wire the concrete implementation only at a composition root. Contracts are owned by the consumer, not by the vendor adapter.

### 5. Keep one source of truth

Every fact, policy, schema, and mapping MUST have one canonical owner. Derive types from Zod/Prisma/tRPC contracts instead of recreating them. Reuse a canonical helper rather than copying logic. Cache and client state may mirror authoritative data only with an explicit invalidation strategy.

### 6. Parse at boundaries; trust only parsed data

Treat HTTP input, forms, environment variables, database JSON, files, queues, webhooks, and third-party responses as `unknown`. Convert them once into trusted domain values with Zod or a typed SDK plus validation. Reject invalid states early. Persisted invariants MUST also be protected with PostgreSQL constraints and transactions.

### 7. Prefer simple, explicit, boring code

Choose stable platform features and established repository patterns. Prefer readable functions, explicit data flow, and direct control flow over inheritance, reflection, hidden mutation, metaprogramming, or clever generic machinery. A future agent MUST be able to locate a rule and follow execution without reconstructing magic spread across the repository.

### 8. Optimize for high cohesion and low coupling

A module MUST have one clear reason to change and expose the smallest useful public surface. Keep behavior with the data and invariants it governs. Avoid grab-bag `utils`, cross-domain imports, shared mutable state, and functions that coordinate unrelated concerns. Split by responsibility or bounded context, not arbitrary technical categories.

### 9. Make abstractions earn their cost

Create an abstraction when it protects a domain boundary, isolates a side effect or volatile dependency, enables a real test seam, or removes proven duplication. Do not add interfaces, factories, repositories, configuration layers, or generic helpers for hypothetical futures. One stable pure implementation usually needs a function, not a hierarchy.

### 10. Deliver narrow vertical slices

Implement the smallest end-to-end change that satisfies explicit acceptance criteria. Touch only files required by the task. Do not combine a feature with unrelated cleanup, dependency upgrades, renames, or speculative refactors. Before editing, inspect the relevant implementation, callers, contracts, tests, and recent history.

### 11. Use red-green testing for changed behavior

For a bug, first add the smallest test that reproduces it and observe the failure. For new behavior, establish a failing executable example when practical, then implement until it passes. Test public behavior and invariants rather than implementation details; a test that never failed may not prove the change.

### 12. Put fast deterministic feedback first

Run the cheapest relevant checks early and repeatedly: focused tests, lint, typecheck, schema validation, then integration/build/end-to-end checks. Deterministic tools outrank probabilistic review. Error output SHOULD be concise and actionable so an agent can self-correct without guessing.

### 13. Fix causes, not symptoms

Reproduce failures and trace the violated invariant before editing. Do not add retries, casts, defaults, exception swallowing, or duplicated state merely to silence an error. A fix MUST explain why the failure occurred and why the chosen layer owns the correction.

### 14. Keep repository knowledge authoritative and discoverable

Architecture, commands, constraints, and consequential decisions MUST live in versioned repository files. `AGENTS.md` is a concise map, not an encyclopedia. Update the closest canonical document in the same change as the code; delete or correct stale guidance immediately.

### 15. Leave clean, reversible increments

Each coherent change MUST leave the repository buildable and understandable, with no half-implemented paths or undocumented temporary state. Commit logical units with descriptive messages. Prefer migrations, feature flags, additive transitions, and other reversible techniques when a change carries operational risk.

### 16. Make behavior observable to agents and humans

Failures MUST surface with useful context while excluding secrets and sensitive payloads. External calls need timeouts and translated errors; important workflows need structured logs, traces, or metrics. A local or isolated environment SHOULD expose enough runtime state for an agent to reproduce and verify behavior directly.

### 17. Minimize blast radius

Use least privilege, scoped credentials, isolated development/test resources, bounded retries, idempotency, and explicit approval for destructive or production actions. Never give an agent or integration broader access because doing so is convenient. Prefer operations that are inspectable and reversible.

### 18. Control entropy continuously

Agents imitate existing patterns, including bad ones. Remove dead code, duplicate helpers, stale docs, obsolete dependencies, flaky tests, and boundary violations in small verified changes before they spread. Repeated review feedback MUST become a documented rule or mechanical check rather than remaining tribal knowledge.

## Relationship to SOLID

SOLID remains expected: cohesive responsibilities, extension through stable seams, substitutable implementations, narrow interfaces, and inward dependencies. These principles add what SOLID does not cover: finite agent context, progressive disclosure, mechanical enforcement, evidence-based completion, scope discipline, clean handoffs, runtime legibility, isolation, and continuous drift control.

Apply dependency inversion selectively: contracts around real boundaries improve decoupling; interfaces around every function create indirection and make the repository harder for both humans and agents to understand.

## Anti-rationalization checks

| Temptation                                  | Binding response                                                                   |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| “This is too small to test.”                | Small changes still need proportionate evidence and explicit acceptance criteria.  |
| “Types pass, so it is correct.”             | Types cannot prove runtime behavior, permissions, persistence, or integrations.    |
| “I will add tests later.”                   | There is no later in an autonomous run; add the evidence with the behavior.        |
| “This abstraction may help someday.”        | Demonstrate a current boundary, volatility point, test seam, or duplication first. |
| “I can clean up nearby code while here.”    | Keep the change focused; propose unrelated cleanup separately.                     |
| “The dependency is easier than an adapter.” | Convenience does not override dependency direction or isolation.                   |
| “The tests pass, so I am done.”             | Also inspect the diff and verify the real interface appropriate to the risk.       |

## Current mechanical enforcement

- TypeScript strictness and type-aware ESLint reject unsafe shortcuts and enforce major import boundaries.
- Zod validates runtime inputs; tRPC carries contracts to clients; Prisma migrations and PostgreSQL enforce persisted integrity.
- Unit, component, real-database integration, Playwright, and Maestro suites provide layered evidence.
- CI repeats format, lint, typecheck, schema, test, build, migration, and end-to-end gates; CodeQL and Dependabot add security and dependency feedback.
- Git history provides reversible checkpoints; `AGENTS.md` defines the required completion workflow.

Rules that cannot yet be enforced mechanically remain binding. When a violation repeats, improve the harness.
