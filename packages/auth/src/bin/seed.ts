import { createDatabaseClient } from "@ai-starter/db";

import {
  localSeedAcknowledgementVariable,
  planDemoSeed,
} from "../demo-seed-plan";
import { demoUser, seedDemoUser, type DemoUserSeedOutcome } from "../demo-user";

/**
 * Runs the demo-user seed against DATABASE_URL. Reached through
 * `packages/tooling/src/bin/db-seed.ts`, which owns the local-only guard and
 * the env loading; this stays the thin runtime half that may import Better
 * Auth and the database client.
 *
 * "Reached through" is now enforced rather than assumed: this is a package
 * script, so it can be invoked directly, and the wrapper's check is worth
 * nothing if skipping the wrapper skips the check.
 */

const messages: Record<DemoUserSeedOutcome, string> = {
  "already-seeded": `demo user ${demoUser.email} is already present`,
  created: `created demo user ${demoUser.email} (password: ${demoUser.password})`,
  "verification-completed": `completed email verification for demo user ${demoUser.email}`,
};

const plan = planDemoSeed({
  acknowledgement: process.env[localSeedAcknowledgementVariable],
  databaseUrl: process.env.DATABASE_URL,
});
if (!plan.run) {
  throw new Error(`db:seed refused: ${plan.message}`);
}

const database = createDatabaseClient(plan.databaseUrl);
try {
  console.log(`db:seed: ${messages[await seedDemoUser(database)]}`);
} finally {
  await database.$disconnect();
}
