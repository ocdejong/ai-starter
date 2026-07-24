import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

import { env } from "~/env";

/**
 * The composition root for the chat model. `LanguageModel` is already the
 * provider-neutral contract the AI SDK works against, so swapping vendor or
 * model touches this file and `AI_CHAT_MODEL` — nothing else wraps `streamText`.
 *
 * Configuration is optional on purpose: a clone with no provider key boots and
 * the chat degrades to an honest "not configured" state, the same rule the
 * email sender follows.
 */
const provider =
  env.ANTHROPIC_API_KEY === undefined
    ? undefined
    : createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });

/** The configured chat model, or `undefined` when no provider key is set. */
export function getChatModel(): LanguageModel | undefined {
  return provider === undefined ? undefined : provider(env.AI_CHAT_MODEL);
}

/** Whether chat can answer at all — read by the UI to render an honest state. */
export function isChatConfigured(): boolean {
  return provider !== undefined;
}
