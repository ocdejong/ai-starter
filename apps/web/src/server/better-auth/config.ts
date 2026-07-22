import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "@ai-starter/db";

import { env } from "~/env";

const googleCredentials =
  env.BETTER_AUTH_GOOGLE_CLIENT_ID && env.BETTER_AUTH_GOOGLE_CLIENT_SECRET
    ? {
        clientId: env.BETTER_AUTH_GOOGLE_CLIENT_ID,
        clientSecret: env.BETTER_AUTH_GOOGLE_CLIENT_SECRET,
      }
    : null;
const githubCredentials =
  env.BETTER_AUTH_GITHUB_CLIENT_ID && env.BETTER_AUTH_GITHUB_CLIENT_SECRET
    ? {
        clientId: env.BETTER_AUTH_GITHUB_CLIENT_ID,
        clientSecret: env.BETTER_AUTH_GITHUB_CLIENT_SECRET,
      }
    : null;

export const primarySocialProvider = googleCredentials
  ? ("google" as const)
  : githubCredentials
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
    ...(googleCredentials && {
      google: {
        accessType: "offline" as const,
        ...googleCredentials,
        prompt: "select_account consent" as const,
      },
    }),
    ...(githubCredentials && {
      github: {
        ...githubCredentials,
      },
    }),
  },
});

export type Session = typeof auth.$Infer.Session;
