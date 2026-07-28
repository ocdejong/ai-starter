import type { Database } from "@ai-starter/db";
import { expo } from "@better-auth/expo";
import {
  betterAuth,
  type BetterAuthOptions,
  type BetterAuthPlugin,
} from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins";

import {
  createPersonalGroup,
  deleteSoleMemberGroups,
  groupOwnerRole,
  seedGroupIdFor,
} from "./personal-group";

/**
 * How long an emailed group invitation stays acceptable. Two days is long
 * enough to survive a weekend and short enough that a forwarded mailbox is not
 * a standing key to the group.
 */
const invitationLifetimeSeconds = 48 * 60 * 60;

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
 * The group invitation dispatch. Better Auth deliberately does not build an
 * accept URL — the link points at a page this package knows nothing about — so
 * the factory hands over the invitation id and the composition root turns it
 * into a link against its own routing.
 */
type AuthGroupInvitationDispatch = (message: {
  readonly to: string;
  readonly invitationId: string;
}) => void;

/**
 * The account-flow emails the factory routes through the injected sender.
 * Keeping them as an explicit record (rather than one generic function) makes
 * each call site name the flow it serves.
 */
export type AuthEmailDispatchers = {
  readonly sendVerification: AuthEmailDispatch;
  readonly sendPasswordReset: AuthEmailDispatch;
  readonly sendChangeEmailVerification: AuthEmailDispatch;
  readonly sendDeleteAccountVerification: AuthEmailDispatch;
  readonly sendGroupInvitation: AuthGroupInvitationDispatch;
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
  /**
   * The per-IP request limit on the auth endpoints.
   *
   * Better Auth turns this on for `NODE_ENV === "production"` and off
   * everywhere else, which means the guard exists in exactly the environment no
   * unit test and no development server ever runs. Its defaults are strict —
   * three requests per ten seconds on sign-in, sign-up, change-password and
   * change-email, three per minute on the mails that carry a token — and this
   * factory keeps them: they are the right numbers for a product, and a caller
   * that passes nothing gets the guard.
   *
   * The one caller that passes something is the browser suite's own server,
   * because every journey it runs shares one address. See
   * `init-auth.integration.test.ts` for the test that keeps the guard covered
   * once the journeys stop meeting it.
   */
  readonly rateLimit?: BetterAuthOptions["rateLimit"];
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
    databaseHooks: {
      session: {
        create: {
          // Seeds the active group so a signed-in user is never groupless. It
          // is a convenience, not an authorization decision: the value travels
          // in the session and may go stale, so every group-scoped procedure
          // re-derives membership instead of trusting it.
          before: async (session, context) => {
            // A password change that revokes the other sessions deletes every
            // row — the caller's included — before this hook runs, so the
            // group the caller was working in survives only in the request
            // context. Carrying it over (membership-checked) is what keeps a
            // password change from silently switching the user's group.
            const caller = context?.context.session?.session;
            const carried: unknown =
              caller?.userId === session.userId
                ? caller.activeOrganizationId
                : null;
            const groupId = await seedGroupIdFor(
              database,
              session.userId,
              typeof carried === "string" ? carried : null,
            );
            return groupId === null
              ? undefined
              : { data: { ...session, activeOrganizationId: groupId } };
          },
        },
      },
      user: {
        create: {
          after: async (user) => {
            await createPersonalGroup(database, user);
          },
        },
        delete: {
          // Memberships cascade with the user, so without this the personal
          // group would survive its only member as an unreachable row.
          before: async (user) => {
            await deleteSoleMemberGroups(database, user.id);
          },
        },
      },
    },
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
    plugins: [
      organization({
        // A second invitation to the same address retires the first, so an
        // address never holds two live keys to one group.
        cancelPendingInvitationsOnReInvite: true,
        creatorRole: groupOwnerRole,
        invitationExpiresIn: invitationLifetimeSeconds,
        // Accepting by invitation id proves nothing on its own; requiring a
        // verified address makes the mailbox the invitation was sent to the
        // proof of ownership.
        requireEmailVerificationOnInvitation: true,
        sendInvitationEmail: async ({ email: to, id }) => {
          email.sendGroupInvitation({ invitationId: id, to });
        },
      }),
      expo(),
      ...(options.plugins ?? []),
    ],
    ...(options.secret === undefined ? {} : { secret: options.secret }),
    session: {
      // Better Auth's session-freshness window (24 hours by default) gates
      // exactly two endpoints: `/list-sessions` and `/unlink-account`. Left on,
      // the settings screen's device list refuses anyone who signed in
      // yesterday — while `/revoke-session`, the destructive half of the same
      // screen, is not gated at all, so the window protects the read and not the
      // write. Nothing else here leans on it: changing a password re-proves the
      // current one, and deleting an account is gated by an emailed link, which
      // is a stronger proof of ownership than a recent sign-in. A product that
      // later exposes account unlinking should decide this again.
      freshAge: 0,
    },
    ...(options.rateLimit === undefined
      ? {}
      : { rateLimit: options.rateLimit }),
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
