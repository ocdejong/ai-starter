import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "@t3-test/db";

import { env } from "~/env";

const googleIsConfigured = Boolean(
  env.BETTER_AUTH_GOOGLE_CLIENT_ID && env.BETTER_AUTH_GOOGLE_CLIENT_SECRET,
);
const githubIsConfigured = Boolean(
  env.BETTER_AUTH_GITHUB_CLIENT_ID && env.BETTER_AUTH_GITHUB_CLIENT_SECRET,
);

export const primarySocialProvider = googleIsConfigured
  ? ("google" as const)
  : githubIsConfigured
    ? ("github" as const)
    : null;

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  database: prismaAdapter(db, {
    provider: "postgresql", // or "sqlite" or "mysql"
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    ...(googleIsConfigured && {
      google: {
        accessType: "offline" as const,
        clientId: env.BETTER_AUTH_GOOGLE_CLIENT_ID!,
        clientSecret: env.BETTER_AUTH_GOOGLE_CLIENT_SECRET!,
        prompt: "select_account consent" as const,
      },
    }),
    ...(githubIsConfigured && {
      github: {
        clientId: env.BETTER_AUTH_GITHUB_CLIENT_ID!,
        clientSecret: env.BETTER_AUTH_GITHUB_CLIENT_SECRET!,
      },
    }),
  },
});

export type Session = typeof auth.$Infer.Session;
