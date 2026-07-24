import type { Database } from "@ai-starter/db";
import { expo } from "@better-auth/expo";
import {
  betterAuth,
  type BetterAuthOptions,
  type BetterAuthPlugin,
} from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

/**
 * One transactional-email dispatch the auth flows trigger. It is deliberately
 * fire-and-forget: the factory hands over a recipient and an action URL and
 * returns immediately, so a slow render or send never widens the request's
 * timing signal (Better Auth's guidance for reset/verification mail). The
 * composition root supplies an implementation that renders a template and hands
 * it to the `EmailSender` port; the auth package never sees React or a vendor.
 */
export type AuthEmailDispatch = (message: {
  readonly to: string;
  readonly url: string;
}) => void;

/**
 * The four account-flow emails the factory routes through the injected sender.
 * Keeping them as an explicit record (rather than one generic function) makes
 * each call site name the flow it serves.
 */
export type AuthEmailDispatchers = {
  readonly sendVerification: AuthEmailDispatch;
  readonly sendPasswordReset: AuthEmailDispatch;
  readonly sendChangeEmailVerification: AuthEmailDispatch;
  readonly sendDeleteAccountVerification: AuthEmailDispatch;
};

export type InitAuthOptions = {
  /** Persistence, injected so an integration test can bind a container client. */
  readonly database: Database;
  /** Better Auth signing secret; optional in development, required in production. */
  readonly secret?: string | undefined;
  /** The canonical origin Better Auth builds action URLs against. */
  readonly baseURL: string;
  /** Origins allowed to start flows: the native scheme and dev Expo URLs. */
  readonly trustedOrigins: readonly string[];
  /** Social providers the composition root configured from optional env. */
  readonly socialProviders?: BetterAuthOptions["socialProviders"];
  /** Fire-and-forget email dispatch, wired at the composition root. */
  readonly email: AuthEmailDispatchers;
  /**
   * Extra plugins appended after `expo()`. The web root passes `nextCookies()`
   * here so it stays the last plugin, as Better Auth requires.
   */
  readonly plugins?: readonly BetterAuthPlugin[];
};

/**
 * Builds the Better Auth instance every consumer shares. It owns the account
 * flows (email verification, password reset, change email, delete account) and
 * the shape both the web composition root and the Expo client depend on; the
 * volatile edges — database, secret, social credentials, email delivery — are
 * injected so the factory stays reusable and testable.
 */
export function initAuth(options: InitAuthOptions) {
  const { database, email } = options;

  return betterAuth({
    baseURL: options.baseURL,
    database: prismaAdapter(database, { provider: "postgresql" }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      // `async` satisfies Better Auth's `Promise<void>` callback contract while
      // the dispatch itself returns synchronously, so the request path is never
      // held open for the render and send.
      sendResetPassword: async ({ user, url }) => {
        email.sendPasswordReset({ to: user.email, url });
      },
    },
    emailVerification: {
      autoSignInAfterVerification: true,
      sendOnSignUp: true,
      // Without this, an unverified sign-in is refused but no fresh link is
      // sent, stranding a user who lost the first one (Better Auth 1.6 gates the
      // resend on this flag; the sign-in route otherwise only throws 403).
      sendOnSignIn: true,
      sendVerificationEmail: async ({ user, url }) => {
        email.sendVerification({ to: user.email, url });
      },
    },
    plugins: [expo(), ...(options.plugins ?? [])],
    ...(options.secret === undefined ? {} : { secret: options.secret }),
    ...(options.socialProviders === undefined
      ? {}
      : { socialProviders: options.socialProviders }),
    trustedOrigins: [...options.trustedOrigins],
    user: {
      changeEmail: {
        enabled: true,
        // Better Auth names this "confirmation" because it goes to the address
        // that must approve the change — the current one. Clicking the link then
        // switches the account to the new address. The recipient is settled
        // empirically by the integration test rather than assumed.
        sendChangeEmailConfirmation: async ({ user, url }) => {
          email.sendChangeEmailVerification({ to: user.email, url });
        },
      },
      deleteUser: {
        enabled: true,
        sendDeleteAccountVerification: async ({ user, url }) => {
          email.sendDeleteAccountVerification({ to: user.email, url });
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof initAuth>;
export type Session = Auth["$Infer"]["Session"];
