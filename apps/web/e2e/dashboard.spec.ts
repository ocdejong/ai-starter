import { expect, test } from "@playwright/test";

import { registerVerifiedAccount } from "./support/account";

/**
 * One UI message stream, hand-written.
 *
 * The chunk names and the `x-vercel-ai-ui-message-stream` header are the wire
 * contract `useChat` reads (`ai`'s `UIMessageChunk` union and
 * `UI_MESSAGE_STREAM_HEADERS`); stubbing at the network boundary is what lets the
 * journey prove the composer, the transport and the transcript without spending a
 * provider token or making the assertion depend on what a model happens to say.
 */
function uiMessageStream(text: string): string {
  const chunks = [
    { type: "start" },
    { type: "start-step" },
    { id: "0", type: "text-start" },
    { delta: text, id: "0", type: "text-delta" },
    { id: "0", type: "text-end" },
    { type: "finish-step" },
    { type: "finish" },
  ];

  return `${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("")}data: [DONE]\n\n`;
}

const stubbedAnswer = "A stubbed answer.";

test("signs in, chats on the dashboard and opens settings", async ({
  page,
}) => {
  // Registration, a mailbox round trip, and six routes that each compile on
  // first request against the development server.
  test.setTimeout(180_000);

  await test.step("a signed-out visitor cannot reach the dashboard", async () => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL("/sign-in", { timeout: 30_000 });
  });

  const { name } =
    await test.step("register and land on the dashboard", async () =>
      registerVerifiedAccount(page));

  await test.step("the shell names the account and the sections", async () => {
    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByRole("button", { name })).toBeVisible();
  });

  await test.step("send a message and read the answer", async () => {
    await page.route("**/api/chat", async (route) => {
      await route.fulfill({
        body: uiMessageStream(stubbedAnswer),
        headers: {
          "content-type": "text/event-stream",
          "x-vercel-ai-ui-message-stream": "v1",
        },
        status: 200,
      });
    });

    await page.getByLabel("Type a message…").fill("Are you there?");
    await page.getByRole("button", { name: "Send" }).click();

    await expect(page.getByText("Are you there?")).toBeVisible();
    await expect(page.getByText(stubbedAnswer)).toBeVisible();
  });

  await test.step("open settings", async () => {
    await page.getByRole("link", { name: "Settings" }).click();

    // `/settings` is a navigation target that opens its first section.
    await expect(page).toHaveURL("/settings/account", { timeout: 30_000 });
    await expect(
      page.getByRole("heading", { level: 1, name: "Settings" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Account" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Group" }).click();

    await expect(page).toHaveURL("/settings/group", { timeout: 30_000 });
    await expect(
      page.getByRole("heading", { level: 2, name: "Group" }),
    ).toBeVisible();
  });

  await test.step("sign out from the account menu", async () => {
    await page.getByRole("button", { name }).click();
    await page.getByRole("button", { name: "Sign out" }).click();

    await expect(page).toHaveURL("/", { timeout: 30_000 });
    await expect(
      page
        .getByRole("navigation", { name: "Get started" })
        .getByRole("link", { name: "Create an account" }),
    ).toBeVisible();
  });
});
