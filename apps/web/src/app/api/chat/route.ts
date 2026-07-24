import { getChatModel } from "~/server/ai";
import { getSession } from "~/server/better-auth/server";
import { handleChatRequest } from "~/server/chat/handler";
import { createChatRateLimiter } from "~/server/chat/rate-limit";

/**
 * Chat is a plain route handler rather than a tRPC procedure: `useChat` speaks
 * the UI message stream protocol, and tRPC streams its own envelope. tRPC
 * remains the API for everything else.
 *
 * This module is a composition root — it resolves the session, the model and
 * the limiter, and hands them to the handler, which owns the guards.
 */

/** Streaming replies outlive the default serverless budget. */
export const maxDuration = 30;

const rateLimiter = createChatRateLimiter({ limit: 20, windowMs: 60_000 });

export async function POST(request: Request): Promise<Response> {
  return handleChatRequest(request, {
    model: getChatModel(),
    rateLimit: (userId) => rateLimiter(userId, Date.now()),
    session: await getSession(),
  });
}
