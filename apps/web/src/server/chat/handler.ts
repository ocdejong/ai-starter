import { chatRequestSchema } from "@ai-starter/domain";
import {
  convertToModelMessages,
  safeValidateUIMessages,
  streamText,
  type LanguageModel,
} from "ai";

import type { RateLimitDecision } from "./rate-limit";

type ChatSession = { readonly user: { readonly id: string } };

export type ChatDependencies = {
  /** `undefined` when the deployment has no provider key configured. */
  readonly model: LanguageModel | undefined;
  readonly rateLimit: (userId: string) => RateLimitDecision;
  readonly session: ChatSession | null;
};

/**
 * The example assistant's instructions. The server owns this: the wire contract
 * refuses client-supplied `system` messages, so nothing a caller sends can
 * replace it.
 */
const chatSystemPrompt =
  "You are the assistant built into this application. Answer clearly and concisely, and say so plainly when you do not know something.";

/**
 * The chat turn, as a function of an HTTP request and its dependencies, so the
 * guards are testable without a server, a session or a live provider.
 *
 * Guard order is deliberate: authenticate, confirm the deployment can answer,
 * then parse — a malformed request must not spend the caller's rate-limit
 * budget, so the limiter runs last, once the request is known to be worth
 * serving. Error bodies carry a code only; message content never travels back
 * out through an error or a log.
 */
export async function handleChatRequest(
  request: Request,
  { model, rateLimit, session }: ChatDependencies,
): Promise<Response> {
  if (session === null) {
    return errorResponse(401, "unauthorized");
  }

  if (model === undefined) {
    return errorResponse(503, "chat_not_configured");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_request");
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "invalid_request");
  }

  // The wire contract owns the envelope and our size policy; the AI SDK stays
  // authoritative for the internals of a message part.
  const messages = await safeValidateUIMessages({
    messages: parsed.data.messages,
  });
  if (!messages.success) {
    return errorResponse(400, "invalid_request");
  }

  const decision = rateLimit(session.user.id);
  if (!decision.allowed) {
    return errorResponse(429, "rate_limited", {
      "retry-after": String(decision.retryAfterSeconds),
    });
  }

  const result = streamText({
    messages: await convertToModelMessages(messages.data),
    model,
    system: chatSystemPrompt,
  });

  return result.toUIMessageStreamResponse();
}

function errorResponse(
  status: number,
  code: string,
  headers: Record<string, string> = {},
): Response {
  return Response.json({ error: code }, { headers: { ...headers }, status });
}
