# Contributing

Read `AGENTS.md` and `docs/architecture.md` first. Create a focused branch, keep commits coherent, and do not mix unrelated cleanup into a feature.

## Setup

```bash
pnpm install
cp apps/web/.env.example apps/web/.env
./start-database.sh
pnpm db:migrate
pnpm dev
```

For a physical phone, copy `apps/mobile/.env.example` to `apps/mobile/.env` and replace localhost with the development machine's LAN address.

Before opening a pull request, run:

```bash
pnpm format:check
pnpm check
pnpm test:integration
pnpm build
pnpm test:e2e
```

Update `.env.example`, migrations, tests, and architecture documentation whenever the corresponding contract changes.
