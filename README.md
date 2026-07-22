# t3-test

A pnpm/Turborepo monorepo with a T3 web application and an Expo mobile application.

## Workspace

```text
apps/
  web/       Next.js, Better Auth and the HTTP adapters
  mobile/    Expo and Expo Router
packages/
  api/       tRPC routers and the client-safe AppRouter type
  domain/    shared Zod schemas and platform-neutral business logic
  db/        server-only Prisma client and schema
  config/    shared TypeScript, ESLint and Vitest configuration
  tokens/    platform-neutral design tokens
```

## Local development

```bash
pnpm install
./start-database.sh
pnpm db:push
pnpm dev
```

`pnpm dev` starts the web application. Run `pnpm dev:mobile` for Expo or
`pnpm dev:all` to start both applications.

Environment variables for the web application and database tooling live in
`apps/web/.env`; use `apps/web/.env.example` as the template.

## Quality checks

```bash
pnpm check
pnpm build
pnpm format:check
```
