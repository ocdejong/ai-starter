import { initAuth } from "@ai-starter/auth";
import { db } from "@ai-starter/db";
import { nextCookies } from "better-auth/next-js";

import { env } from "~/env";
import { emailSender } from "~/server/email";
import { createAuthEmailDispatchers } from "~/server/better-auth/email-dispatch";

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

const socialProviders = {
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
};

export const auth = initAuth({
  baseURL: env.BETTER_AUTH_URL,
  database: db,
  email: createAuthEmailDispatchers(emailSender, {
    appUrl: env.BETTER_AUTH_URL,
  }),
  // nextCookies() must stay the last plugin; initAuth appends these after expo().
  plugins: [nextCookies()],
  secret: env.BETTER_AUTH_SECRET,
  socialProviders,
  trustedOrigins: [
    "ai-starter://",
    ...(env.NODE_ENV === "development" ? ["exp://"] : []),
  ],
});
