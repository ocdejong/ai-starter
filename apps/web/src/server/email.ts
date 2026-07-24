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
 */
export const emailSender: EmailSender = createEmailSender({
  from: env.EMAIL_FROM ?? "AI Starter <onboarding@resend.dev>",
  mailboxDir: path.join(process.cwd(), ".mail"),
  resendApiKey: env.RESEND_API_KEY,
});
