import type { Database } from "@ai-starter/db";

import { initAuth } from "./init-auth";

/**
 * The development sign-in `pnpm bootstrap` seeds so a fresh checkout can be
 * signed into immediately. Documented in README.md; deliberately generic so
 * `starter:init` has nothing identity-bearing to rewrite.
 */
export const demoUser = {
  email: "demo@example.com",
  name: "Demo User",
  password: "demo-password",
} as const;

/**
 * Signs only the verification token that lives inside one seed run — the seed
 * issues it and redeems it in the same process. Nothing persisted depends on
 * this value, so it is a constant rather than configuration.
 */
const seedOnlySigningSecret = "seed-only-verification-token-secret";

export type DemoUserSeedOutcome =
  "created" | "verification-completed" | "already-seeded";

const dispatchNothing = () => undefined;

/**
 * Creates the demo account through the real Better Auth flows — sign-up, then
 * the emailed verification link, captured instead of sent — so every row
 * (password hash, account, personal group, membership) is exactly what the app
 * itself would have written. Safe to re-run: a verified account is left alone,
 * and an account a crashed run left unverified is taken the rest of the way.
 */
export async function seedDemoUser(
  database: Database,
): Promise<DemoUserSeedOutcome> {
  const existing = await database.user.findUnique({
    select: { emailVerified: true },
    where: { email: demoUser.email },
  });
  if (existing?.emailVerified === true) {
    return "already-seeded";
  }

  let verificationUrl: string | undefined;
  const auth = initAuth({
    // Only prefixes the captured link; the seed never contacts this origin.
    baseURL: "http://localhost:3000",
    database,
    email: {
      sendChangeEmailVerification: dispatchNothing,
      sendDeleteAccountVerification: dispatchNothing,
      sendGroupInvitation: dispatchNothing,
      sendPasswordReset: dispatchNothing,
      sendVerification: ({ url }) => {
        verificationUrl = url;
      },
    },
    secret: seedOnlySigningSecret,
    trustedOrigins: [],
  });

  if (existing === null) {
    // `sendOnSignUp` dispatches the verification link before this resolves.
    await auth.api.signUpEmail({ body: { ...demoUser } });
  } else {
    await auth.api.sendVerificationEmail({ body: { email: demoUser.email } });
  }

  if (verificationUrl === undefined) {
    throw new Error(
      "Better Auth dispatched no verification email while seeding the demo user.",
    );
  }
  const token = new URL(verificationUrl).searchParams.get("token");
  if (token === null) {
    throw new Error("The seeded verification link carries no token to redeem.");
  }
  await auth.api.verifyEmail({ query: { token } });

  return existing === null ? "created" : "verification-completed";
}
