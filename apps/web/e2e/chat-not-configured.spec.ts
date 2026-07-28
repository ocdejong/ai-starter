import { expect, test } from "@playwright/test";

/**
 * What a clone with no vendor keys looks like.
 *
 * This spec runs against a second web server that `playwright.config.ts` starts
 * without `ANTHROPIC_API_KEY` — the state every fresh checkout boots into, and
 * one no request can reach on the keyed server, because the model factory reads
 * its environment once at module scope. The promise being kept is the one the
 * repository makes about every vendor: absent a key, the product still boots and
 * says so instead of failing.
 */
test("says chat is not configured, and offers no way to send", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Ask the assistant" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Chat is not configured. Set ANTHROPIC_API_KEY to enable it.",
    ),
  ).toBeVisible();

  await expect(page.getByLabel("Type a message…")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Send" })).toBeDisabled();

  // The landing page is otherwise whole: an unconfigured vendor degrades one
  // feature, never the page it sits on.
  await expect(
    page
      .getByRole("navigation", { name: "Get started" })
      .getByRole("link", { name: "Create an account" }),
  ).toBeVisible();
});
