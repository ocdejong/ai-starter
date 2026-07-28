/**
 * @vitest-environment node
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import type * as ChatModelModule from "./ai";

/**
 * The model factory is read once, at module scope, so every case here loads the
 * module again with a different environment — which is also the only way to
 * reach the branch a keyless clone runs in.
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Every variable `~/env` requires, so the schema validates before the branch under test. */
function configure(overrides: Readonly<Record<string, string>>): void {
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  vi.stubEnv("DATABASE_URL", "postgresql://user:password@localhost:5432/test");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.stubEnv("AI_CHAT_MODEL", "");
  for (const [name, value] of Object.entries(overrides)) {
    vi.stubEnv(name, value);
  }
}

type ChatModelFactory = typeof ChatModelModule;

async function loadFactory(): Promise<ChatModelFactory> {
  vi.resetModules();
  return import("./ai");
}

/** `LanguageModel` widens to `string | LanguageModelV3`; only the object carries an id. */
function modelId(model: unknown): string | undefined {
  return typeof model === "object" &&
    model !== null &&
    "modelId" in model &&
    typeof model.modelId === "string"
    ? model.modelId
    : undefined;
}

describe("the chat model factory", () => {
  it("reports no chat and offers no model without a provider key", async () => {
    configure({});

    const { getChatModel, isChatConfigured } = await loadFactory();

    expect(isChatConfigured()).toBe(false);
    expect(getChatModel()).toBeUndefined();
  });

  it("asks the provider for the model AI_CHAT_MODEL names", async () => {
    configure({
      AI_CHAT_MODEL: "claude-opus-4-5",
      ANTHROPIC_API_KEY: "sk-ant-fake",
    });

    const { getChatModel, isChatConfigured } = await loadFactory();

    expect(isChatConfigured()).toBe(true);
    expect(modelId(getChatModel())).toBe("claude-opus-4-5");
  });

  it("falls back to the model the schema defaults to", async () => {
    configure({ ANTHROPIC_API_KEY: "sk-ant-fake" });

    const { getChatModel } = await loadFactory();

    // `pnpm diagnose` names this same default when it reports what chat would
    // answer with; the two are kept in step by hand.
    expect(modelId(getChatModel())).toBe("claude-sonnet-5");
  });
});
