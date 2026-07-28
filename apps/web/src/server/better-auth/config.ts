import { initAuth } from "@ai-starter/auth";
import { db } from "@ai-starter/db";
import { nextCookies } from "better-auth/next-js";

import { env } from "~/env";
import {
  oauthCredentials,
  resolvePrimarySocialProvider,
} from "~/lib/social-providers";
import { emailSender } from "~/server/email";
import { createAuthEmailDispatchers } from "~/server/better-auth/email-dispatch";

const googleCredentials = oauthCredentials(
  env.BETTER_AUTH_GOOGLE_CLIENT_ID,
  env.BETTER_AUTH_GOOGLE_CLIENT_SECRET,
);
const githubCredentials = oauthCredentials(
  env.BETTER_AUTH_GITHUB_CLIENT_ID,
  env.BETTER_AUTH_GITHUB_CLIENT_SECRET,
);

export const primarySocialProvider = resolvePrimarySocialProvider({
  github: githubCredentials,
  google: googleCredentials,
});

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
  // Better Auth's own defaults are kept — three requests per ten seconds on
  // sign-in, sign-up, change-password and change-email, per address — and they
  // are on wherever it says they are, which is production. The exemption exists
  // for one caller: the browser suite drives fourteen journeys from a single
  // address in two minutes, so the guard sees one attacker rather than fourteen
  // people. `pnpm diagnose` fails when a checkout has this set.
  ...(env.BETTER_AUTH_RATE_LIMIT_DISABLED
    ? { rateLimit: { enabled: false } }
    : {}),
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
