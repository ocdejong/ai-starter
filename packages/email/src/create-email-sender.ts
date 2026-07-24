import type { EmailSender } from "@ai-starter/api";

import { createDevEmailSender } from "./adapters/dev-mailbox-sender";
import { createResendEmailSender } from "./adapters/resend-sender";

export type EmailSenderConfig = {
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

  return createDevEmailSender(config.mailboxDir);
}
