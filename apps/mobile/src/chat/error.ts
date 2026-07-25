import { z } from "zod";

/**
 * The chat endpoint answers a refusal with `{ error: "<code>" }` and nothing
 * else, and the AI SDK surfaces a failed response as an `Error` whose message is
 * that raw body. So the body is untrusted input arriving through an error
 * message: parse it, never read it by hand.
 */
const chatErrorBodySchema = z.object({ error: z.string() });

/** The code the server refused with, or `undefined` for any other failure. */
export function chatErrorCode(error: Error | undefined): string | undefined {
  if (error === undefined) {
    return undefined;
  }

  let body: unknown;
  try {
    body = JSON.parse(error.message);
  } catch {
    return undefined;
  }

  const parsed = chatErrorBodySchema.safeParse(body);
  return parsed.success ? parsed.data.error : undefined;
}

/**
 * The deployment has no provider key. Web reads this from its own composition
 * root before rendering; a native app has no such access, so it learns the same
 * fact from the server rather than from a second copy of the configuration.
 */
export const chatNotConfiguredCode = "chat_not_configured";
