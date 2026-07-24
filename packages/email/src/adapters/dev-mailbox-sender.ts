import { mkdir, writeFile } from "node:fs/promises";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { z } from "zod";

import type {
  EmailMessage,
  EmailSender,
  EmailSendResult,
} from "@ai-starter/api";

export type StoredEmail = EmailMessage & { readonly sentAt: string };

const storedEmailSchema = z.object({
  html: z.string(),
  sentAt: z.string(),
  subject: z.string(),
  text: z.string(),
  to: z.string(),
});

/**
 * A process-wide, monotonically increasing counter that prefixes each mailbox
 * filename. Zero-padded, it makes the on-disk sort order match the send order
 * even for two messages written inside the same millisecond, so `readMailbox`
 * is deterministic without a database.
 */
let sequence = 0;

/**
 * The sender a clone with no `RESEND_API_KEY` uses. It logs the message and
 * writes it to an on-disk mailbox; the plaintext body holds the action URL,
 * which is what makes local verification links and the later Playwright
 * journeys clickable.
 */
export function createDevEmailSender(
  dir: string,
  log: (line: string) => void = (line) => {
    console.info(line);
  },
): EmailSender {
  return {
    async send(message: EmailMessage): Promise<EmailSendResult> {
      await mkdir(dir, { recursive: true });

      const record: StoredEmail = {
        ...message,
        sentAt: new Date().toISOString(),
      };
      const filename = `${String(sequence).padStart(12, "0")}-${Date.now()}.json`;
      sequence += 1;

      await writeFile(
        path.join(dir, filename),
        JSON.stringify(record, null, 2),
        "utf8",
      );
      log(
        `[email:dev] to=${message.to} subject=${message.subject}\n${message.text}`,
      );

      return { id: null, ok: true };
    },
  };
}

/**
 * Reads every message a dev mailbox holds, in send order. Files on disk are
 * untrusted input, so each is parsed before it is returned. A directory that
 * does not exist yet is an empty mailbox, not an error.
 */
export function readMailbox(dir: string): StoredEmail[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  return entries
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) =>
      storedEmailSchema.parse(
        JSON.parse(readFileSync(path.join(dir, name), "utf8")),
      ),
    );
}
