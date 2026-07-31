import type { EmailSender } from "@ai-starter/api";

import { createDevEmailSender } from "./adapters/dev-mailbox-sender";
import { createResendEmailSender } from "./adapters/resend-sender";

export type EmailSenderConfig = {
  /**
   * Whether falling back to the on-disk dev mailbox is acceptable here. The
   * mailbox writes every message to `.mail/` and logs its text, and that text
   * carries the verification and password-reset URLs, which are bearer tokens.
   * That is exactly right on a developer's machine and a token leak anywhere
   * else, so the composition root decides rather than this module guessing from
   * an environment it is not allowed to read.
   */
  allowDevMailbox: boolean;
  /** From address for outgoing mail, e.g. `AI Starter <onboarding@resend.dev>`. */
  from: string;
  /** Directory the dev mailbox writes to when Resend is not configured. */
  mailboxDir: string;
  /** A Resend API key, or `undefined`/empty to fall back to the dev mailbox. */
  resendApiKey: string | undefined;
};

/**
 * Selects the concrete sender from already-parsed configuration. Reading and
 * validating the environment is the composition root's job; this stays pure so
 * the fallback behaviour a keyless clone depends on is unit-testable.
 */
export function createEmailSender(config: EmailSenderConfig): EmailSender {
  if (config.resendApiKey !== undefined && config.resendApiKey !== "") {
    return createResendEmailSender(config.resendApiKey, config.from);
  }

  return config.allowDevMailbox
    ? createDevEmailSender(config.mailboxDir)
    : createUnconfiguredEmailSender();
}

/**
 * The sender for a deployment that has no mailer and may not use the dev
 * mailbox. It refuses per message rather than throwing at construction on
 * purpose: the web composition root builds the sender at module scope and
 * `next build` runs with `NODE_ENV=production`, so a constructor that threw
 * would fail the build of every keyless clone — including the one
 * `pnpm rehearse:template` builds — instead of the deployment that is actually
 * misconfigured.
 */
function createUnconfiguredEmailSender(): EmailSender {
  return {
    send: () =>
      Promise.resolve({
        error:
          "No RESEND_API_KEY is configured and the dev mailbox is not available outside development, so the message was not sent.",
        ok: false,
      }),
  };
}
