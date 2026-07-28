import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * A stand-in for the Anthropic Messages API, so the chat route can be driven
 * end to end without a provider key, a network call, or an answer that varies.
 *
 * `createAnthropic` already reads `ANTHROPIC_BASE_URL` from the environment, so
 * nothing in the product needs a test seam: point that variable at this server
 * and every layer above it — the provider adapter, `streamText`, the UI message
 * stream, `useChat` — is the real one. That is the difference between this and
 * a mock `LanguageModel`: the vendor adapter's own parsing is under test too.
 *
 * The event shapes below are Anthropic's streaming wire format, and
 * `@ai-sdk/anthropic` validates them with Zod on the way in — so a stream this
 * module gets wrong fails loudly rather than degrading to an empty answer.
 */

/**
 * What the fake answers with in the browser suite. It is asserted verbatim, so
 * it has to be a sentence no other copy on the page contains.
 */
export const fakeAnthropicAnswer =
  "The chat route answered through the fake provider.";

export type FakeAnthropic = {
  /** The value `ANTHROPIC_BASE_URL` should carry to reach this server. */
  readonly baseUrl: string;
  readonly close: () => Promise<void>;
};

/** One assistant turn, delivered as the single text block a chat reply is. */
function anthropicMessageStream(text: string): string {
  const events = [
    {
      message: {
        id: "msg_fake",
        model: "fake-model",
        role: "assistant",
        usage: { input_tokens: 1 },
      },
      type: "message_start",
    },
    {
      content_block: { text: "", type: "text" },
      index: 0,
      type: "content_block_start",
    },
    {
      delta: { text, type: "text_delta" },
      index: 0,
      type: "content_block_delta",
    },
    { index: 0, type: "content_block_stop" },
    {
      delta: { stop_reason: "end_turn" },
      type: "message_delta",
      usage: { output_tokens: 1 },
    },
    { type: "message_stop" },
  ];

  return events
    .map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
    .join("");
}

/**
 * Starts the fake on `port`, or on a free port when none is given. A `GET`
 * answers so a readiness probe — Playwright's `webServer.url` — has something to
 * ask; every `POST` is treated as a completion request, because the only caller
 * is the provider adapter and it has exactly one endpoint.
 */
export function startFakeAnthropic(options: {
  readonly text: string;
  readonly port?: number;
}): Promise<FakeAnthropic> {
  const server = createServer((request, response) => {
    if (request.method !== "POST") {
      response.writeHead(200, { "content-type": "text/plain" }).end("ok");
      return;
    }

    // The request body is not read: nothing here depends on it, and leaving the
    // stream unread would keep the socket from closing.
    request.resume();
    request.on("end", () => {
      response.writeHead(200, {
        "cache-control": "no-cache",
        "content-type": "text/event-stream",
      });
      response.end(anthropicMessageStream(options.text));
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 0, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise((done, failed) => {
            server.close((error) => {
              if (error) {
                failed(error);
              } else {
                done();
              }
            });
          }),
      });
    });
  });
}
