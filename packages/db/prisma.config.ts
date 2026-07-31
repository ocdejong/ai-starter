import { defineConfig } from "prisma/config";

/**
 * The Prisma CLI's configuration. This replaces `package.json#prisma`, which
 * Prisma 6 deprecates — with a warning on every install — and Prisma 7 removes.
 *
 * The seed command is the one setting that lived there. It stays a command
 * rather than a module path because `pnpm db:seed` and `prisma migrate dev`
 * have to reach the same seed, and only one of them goes through Prisma.
 *
 * Paths here resolve from this file's directory, which is also where the CLI
 * runs, so `prisma/schema.prisma` is the same string the scripts used to pass
 * as `--schema`. Declaring it once is the point: the schema's location is now
 * one fact in one place instead of a flag repeated across nine scripts.
 *
 * One consequence is worth knowing before copying this file anywhere, because
 * the CLI announces it and it is easy to read past: **the presence of this
 * file turns off Prisma's own `.env` loading** — every run now prints "Prisma
 * config detected, skipping environment variable loading". Nothing here
 * depends on that loading, because each root `db:*` script that needs a
 * connection already passes `dotenv -e apps/web/.env` explicitly, and the ones
 * that do not need one (`generate`, `validate`) never read it. A repository
 * that leaned on the implicit behaviour would lose `DATABASE_URL` the moment
 * this file appeared, with no error naming the cause.
 */
export default defineConfig({
  migrations: {
    seed: "node ../tooling/src/bin/db-seed.ts",
  },
  schema: "prisma/schema.prisma",
});
