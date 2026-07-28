import { expect, test } from "@playwright/test";

import { fakeAnthropicAnswer } from "../src/test/fake-anthropic";
import { registerVerifiedAccount } from "./support/account";

/**
 * Nothing here is stubbed.
 *
 * The composer posts to the real `/api/chat`, which resolves the real session,
 * parses with the shared wire contract, spends the real limiter and streams
 * through the real provider adapter — `playwright.config.ts` only moves the
 * provider's own endpoint to a fake one, so the answer is fixed and no token is
 * spent. A stub at the network boundary would have proved the composer and the
 * transcript and left the route itself unexecuted, which is what it did until
 * this stage.
 */
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
    const answered = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/chat") && response.status() === 200,
    );

    await page.getByLabel("Type a message…").fill("Are you there?");
    await page.getByRole("button", { name: "Send" }).click();

    // The route answering at all is half the assertion: the body the transport
    // builds has to be one the server's own schema accepts, or this is a 400.
    await answered;

    await expect(page.getByText("Are you there?")).toBeVisible();
    await expect(page.getByText(fakeAnthropicAnswer)).toBeVisible();
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
