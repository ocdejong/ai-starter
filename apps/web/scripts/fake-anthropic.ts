import {
  fakeAnthropicAnswer,
  startFakeAnthropic,
} from "../src/test/fake-anthropic.ts";

/**
 * Serves the fake Anthropic endpoint the browser suite points the chat route at.
 *
 * Playwright starts it as a web server of its own and waits for it to answer,
 * because it has to be listening before Next.js is: the provider is built at
 * module scope from `ANTHROPIC_BASE_URL`. Nothing else runs this.
 */
const portArgument = process.argv[process.argv.indexOf("--port") + 1];
const port = Number(portArgument);

if (!Number.isInteger(port) || port <= 0) {
  console.error("Usage: node scripts/fake-anthropic.ts --port <port>");
  process.exitCode = 1;
} else {
  const fake = await startFakeAnthropic({ port, text: fakeAnthropicAnswer });
  console.log(`fake Anthropic endpoint listening on ${fake.baseUrl}`);
}
