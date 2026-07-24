import { Resend } from "resend";
import { z } from "zod";

import type {
  EmailMessage,
  EmailSender,
  EmailSendResult,
} from "@ai-starter/api";

type ResendSendPayload = {
  from: string;
  html: string;
  subject: string;
  text: string;
  to: string;
};

/**
 * The slice of the Resend SDK this adapter uses, narrowed so a test can supply
 * a fake in place of the real client and no request ever leaves the machine.
 */
export type ResendLike = {
  emails: { send: (payload: ResendSendPayload) => Promise<unknown> };
};

/**
 * The `resend` SDK returns `{ data, error }` and never throws on a rejected
 * send, so the response is untrusted input that has to be parsed before it is
 * mapped — per the repository rule for third-party SDK responses.
 */
const resendResultSchema = z.object({
  data: z.object({ id: z.string() }).nullable(),
  error: z.object({ message: z.string(), name: z.string() }).nullable(),
});

export function translateResendResult(response: unknown): EmailSendResult {
  const parsed = resendResultSchema.parse(response);

  if (parsed.error !== null) {
    return {
      error: `${parsed.error.name}: ${parsed.error.message}`,
      ok: false,
    };
  }

  if (parsed.data !== null) {
    return { id: parsed.data.id, ok: true };
  }

  return { error: "Resend returned neither a result nor an error.", ok: false };
}

function resendClient(apiKey: string): ResendLike {
  const resend = new Resend(apiKey);
  return { emails: { send: (payload) => resend.emails.send(payload) } };
}

export function createResendEmailSender(
  apiKey: string,
  from: string,
  client: ResendLike = resendClient(apiKey),
): EmailSender {
  return {
    async send(message: EmailMessage): Promise<EmailSendResult> {
      const response = await client.emails.send({
        from,
        html: message.html,
        subject: message.subject,
        text: message.text,
        to: message.to,
      });

      return translateResendResult(response);
    },
  };
}
