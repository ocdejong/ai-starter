import { z } from "zod";

/**
 * The wire contract for a chat turn, shared by every client that posts to the
 * chat endpoint so web and native type the same payload.
 *
 * The split of responsibility is deliberate: this schema owns the envelope and
 * the product's own size policy, while the AI SDK's `validateUIMessages` stays
 * authoritative for the internals of a message part. Parts are therefore parsed
 * loosely — unknown keys survive so the provider schema still sees what the
 * client actually sent.
 */

/** Turns one request may carry. A chat with no persistence cannot need more. */
export const maxChatMessagesPerRequest = 40;

/** Total characters of message text one request may carry. */
export const maxChatCharactersPerRequest = 8_000;

const chatMessagePartSchema = z.looseObject({
  type: z.string().min(1),
  /** Present on text-bearing parts; absent on markers such as `step-start`. */
  text: z.string().optional(),
});

/**
 * `system` is deliberately absent: the server owns the system prompt, and a
 * client that could send one would be writing instructions the model trusts.
 */
const chatMessageSchema = z.looseObject({
  id: z.string().min(1),
  parts: z.array(chatMessagePartSchema).min(1),
  role: z.enum(["user", "assistant"]),
});

const chatRequestEnvelopeSchema = z.looseObject({
  id: z.string().min(1).optional(),
  messageId: z.string().min(1).optional(),
  messages: z.array(chatMessageSchema).min(1).max(maxChatMessagesPerRequest),
  trigger: z.enum(["submit-message", "regenerate-message"]).optional(),
});

type ChatRequestEnvelope = z.infer<typeof chatRequestEnvelopeSchema>;

/** Characters of message text a request carries, across every message and part. */
export function chatRequestCharacterCount(
  request: ChatRequestEnvelope,
): number {
  return request.messages.reduce(
    (total, message) =>
      total +
      message.parts.reduce(
        (subtotal, part) => subtotal + (part.text?.length ?? 0),
        0,
      ),
    0,
  );
}

export const chatRequestSchema = chatRequestEnvelopeSchema.refine(
  (request) =>
    chatRequestCharacterCount(request) <= maxChatCharactersPerRequest,
  {
    message: `A chat request may carry at most ${maxChatCharactersPerRequest} characters of message text.`,
    path: ["messages"],
  },
);

export type ChatRequest = z.infer<typeof chatRequestSchema>;
