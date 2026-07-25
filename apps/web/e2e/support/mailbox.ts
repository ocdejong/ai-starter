import path from "node:path";

import { readMailbox, type StoredEmail } from "@ai-starter/email/mailbox";
import { expect } from "@playwright/test";

/**
 * With no `RESEND_API_KEY` the composition root writes mail to this directory
 * instead of sending it, and the dev server runs from `apps/web` — the same cwd
 * these specs run from. Reading it is how a journey follows a real link rather
 * than reaching into the database for a token the user never sees.
 */
const mailboxDir = path.join(process.cwd(), ".mail");

/**
 * Auth callbacks dispatch mail fire-and-forget, so the response arrives before
 * the message does. `index` counts messages to this address within this run;
 * every run uses a fresh address, so the mailbox surviving between runs is fine.
 */
export async function emailTo(to: string, index: number): Promise<StoredEmail> {
  let messages: StoredEmail[] = [];

  await expect
    .poll(
      () => {
        messages = readMailbox(mailboxDir).filter(
          (message) => message.to === to,
        );
        return messages.length;
      },
      { message: `Expected at least ${index + 1} messages to ${to}.` },
    )
    .toBeGreaterThan(index);

  const message = messages[index];
  if (message === undefined) {
    throw new Error(`No message ${index} for ${to}.`);
  }
  return message;
}

/**
 * Every template prints its action URL in the plaintext body, which is what
 * makes a dev-mailbox message clickable without parsing HTML.
 */
export function actionUrl(message: StoredEmail): string {
  const match = /https?:\/\/[^\s<>"\]]+/.exec(message.text);
  if (match === null) {
    throw new Error(`No action URL in the "${message.subject}" email.`);
  }
  return match[0];
}
