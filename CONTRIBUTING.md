# Contributing

Read `AGENTS.md` and `docs/architecture.md` first. Create a focused branch, keep commits coherent, and do not mix unrelated cleanup into a feature.

## Setup

```bash
pnpm bootstrap
pnpm dev
```

Run `pnpm diagnose` if the checkout does not behave.

For a physical phone, copy `apps/mobile/.env.example` to `apps/mobile/.env` and replace localhost with the development machine's LAN address.

Use `pnpm verify:changed` while iterating. Open the pull request as a draft and mark it ready once `pnpm verify:changed` passes; CI then runs every lane on the ready pull request, and that run is the gate. A full local `pnpm verify` is optional, for a risky change or when CI is unavailable.

Open the pull request as a draft: CI skips drafts and runs the full suite once, when you mark the pull request ready for review.

Update `.env.example`, migrations, tests, and architecture documentation whenever the corresponding contract changes.
