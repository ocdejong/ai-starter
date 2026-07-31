import path from "node:path";

import type { EmailSender } from "@ai-starter/api";
import { createEmailSender } from "@ai-starter/email";

import { env } from "~/env";

/**
 * The composition root for transactional email: it reads the parsed environment
 * and picks the concrete sender. With a `RESEND_API_KEY` set, mail goes through
 * Resend; without one, a clone still boots and writes to a local dev mailbox so
 * verification links stay clickable. Auth callbacks in a later stage dispatch
 * through this instance fire-and-forget.
 *
 * The dev mailbox is confined to non-production because it puts the action URL
 * — a bearer token — on disk and in the logs. A production deployment that has
 * lost its key therefore sends nothing and says so on every attempt, rather
 * than appearing to work while leaking every token it was asked to mail.
 */
export const emailSender: EmailSender = createEmailSender({
  allowDevMailbox:
    env.NODE_ENV !== "production" || env.EMAIL_DEV_MAILBOX_ENABLED,
  from: env.EMAIL_FROM ?? "AI Starter <onboarding@resend.dev>",
  mailboxDir: path.join(process.cwd(), ".mail"),
  resendApiKey: env.RESEND_API_KEY,
});
