import path from "node:path";

import { readMailbox, type StoredEmail } from "@ai-starter/email/mailbox";
import { expect, test } from "@playwright/test";

/**
 * With no `RESEND_API_KEY` the composition root writes mail to this directory
 * instead of sending it, and the dev server runs from `apps/web` — the same cwd
 * this file is run from. Reading it is how the journey follows a real link
 * rather than reaching into the database for a token the user never sees.
 */
const mailboxDir = path.join(process.cwd(), ".mail");

/**
 * Auth callbacks dispatch mail fire-and-forget, so the response arrives before
 * the message does. `index` counts messages to this address within this run;
 * every run uses a fresh address, so the mailbox surviving between runs is fine.
 */
async function emailTo(to: string, index: number): Promise<StoredEmail> {
  let messages: StoredEmail[] = [];

  await expect
    .poll(
      () => {
        messages = readMailbox(mailboxDir).filter(
          (message) => message.to === to,
        );
        return messages.length;
      },
      { message: `Expected at least ${index + 1} messages to ${to}.` },
    )
    .toBeGreaterThan(index);

  const message = messages[index];
  if (message === undefined) {
    throw new Error(`No message ${index} for ${to}.`);
  }
  return message;
}

/**
 * Every template prints its action URL in the plaintext body, which is what
 * makes a dev-mailbox message clickable without parsing HTML.
 */
function actionUrl(message: StoredEmail): string {
  const match = /https?:\/\/[^\s<>"\]]+/.exec(message.text);
  if (match === null) {
    throw new Error(`No action URL in the "${message.subject}" email.`);
  }
  return match[0];
}

test("registers, confirms by email, resets the password and signs in again", async ({
  page,
}) => {
  // Six pages, two round trips through the mailbox, and against the development
  // server each new route compiles on first request. The default per-test budget
  // is for a single interaction, not a journey this long.
  test.setTimeout(180_000);

  const email = `ada-${String(Date.now())}@example.com`;
  const firstPassword = "the first correct password";
  const secondPassword = "the second correct password";

  await test.step("register", async () => {
    await page.goto("/sign-up");
    await page.getByLabel("Name", { exact: true }).fill("Ada Lovelace");
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(firstPassword);
    await page.getByRole("button", { name: "Create account" }).click();

    // Registration renders and writes the confirmation email before it answers,
    // and against the development server this is the request that first compiles
    // that path — so it gets a longer leash than the default assertion timeout.
    await expect(
      page.getByRole("heading", { name: "Confirm your email address" }),
    ).toBeVisible({ timeout: 30_000 });
  });

  await test.step("follow the confirmation link and land signed in", async () => {
    await page.goto(actionUrl(await emailTo(email, 0)));

    // Confirming signs the account in, so the auth layout sends it home.
    await expect(page).toHaveURL("/");
    await expect(page.getByText("Logged in as Ada Lovelace")).toBeVisible();
  });

  await test.step("sign out", async () => {
    await page.getByRole("button", { name: "Sign out" }).click();

    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(page.getByText("Logged in as")).toBeHidden();
  });

  await test.step("ask for a password reset", async () => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();

    await expect(
      page.getByRole("heading", { name: "Check your email" }),
    ).toBeVisible();
  });

  await test.step("follow the reset link and choose a new password", async () => {
    await page.goto(actionUrl(await emailTo(email, 1)));

    // The emailed link is the auth server's endpoint; it checks the token and
    // redirects here with it in the query.
    await expect(page).toHaveURL(/\/reset-password\?token=.+/);

    await page.getByLabel("New password", { exact: true }).fill(secondPassword);
    await page
      .getByLabel("Confirm new password", { exact: true })
      .fill(secondPassword);
    await page.getByRole("button", { name: "Save new password" }).click();

    await expect(
      page.getByRole("heading", { name: "Password updated" }),
    ).toBeVisible();
  });

  await test.step("sign in with the new password", async () => {
    await page.getByRole("link", { name: "Sign in" }).click();
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(secondPassword);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByText("Logged in as Ada Lovelace")).toBeVisible();
  });
});
