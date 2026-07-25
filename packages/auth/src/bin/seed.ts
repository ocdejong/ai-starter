import { createDatabaseClient } from "@ai-starter/db";

import { demoUser, seedDemoUser, type DemoUserSeedOutcome } from "../demo-user";

/**
 * Runs the demo-user seed against DATABASE_URL. Reached through
 * `packages/tooling/src/bin/db-seed.ts`, which owns the local-only guard and
 * the env loading; this stays the thin runtime half that may import Better
 * Auth and the database client.
 */

const messages: Record<DemoUserSeedOutcome, string> = {
  "already-seeded": `demo user ${demoUser.email} is already present`,
  created: `created demo user ${demoUser.email} (password: ${demoUser.password})`,
  "verification-completed": `completed email verification for demo user ${demoUser.email}`,
};

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl === "") {
  throw new Error(
    "DATABASE_URL is not set. Run `pnpm db:seed` from the repository root, which loads apps/web/.env.",
  );
}

const database = createDatabaseClient(databaseUrl);
try {
  console.log(`db:seed: ${messages[await seedDemoUser(database)]}`);
} finally {
  await database.$disconnect();
}
