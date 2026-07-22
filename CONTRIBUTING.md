# Contributing

Read `AGENTS.md` and `docs/architecture.md` first. Create a focused branch, keep commits coherent, and do not mix unrelated cleanup into a feature.

## Setup

```bash
pnpm bootstrap
pnpm dev
```

Run `pnpm run doctor` if the checkout does not behave.

For a physical phone, copy `apps/mobile/.env.example` to `apps/mobile/.env` and replace localhost with the development machine's LAN address.

Use `pnpm verify:changed` while iterating. Before opening a pull request, run the authoritative suite:

```bash
pnpm verify
```

Update `.env.example`, migrations, tests, and architecture documentation whenever the corresponding contract changes.
