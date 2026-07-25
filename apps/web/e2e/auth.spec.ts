import { expect, test } from "@playwright/test";

import { registerVerifiedAccount } from "./support/account";
import { actionUrl, emailTo } from "./support/mailbox";

test("registers, confirms by email, resets the password and signs in again", async ({
  page,
}) => {
  // Six pages, two round trips through the mailbox, and against the development
  // server each new route compiles on first request. The default per-test budget
  // is for a single interaction, not a journey this long.
  test.setTimeout(180_000);

  const { email, name } = await registerVerifiedAccount(page);
  const secondPassword = "the second correct password";

  await test.step("the confirmation left the visitor signed in", async () => {
    await expect(page.getByRole("button", { name })).toBeVisible();
  });

  await test.step("sign out", async () => {
    await page.getByRole("button", { name }).click();
    await page.getByRole("button", { name: "Sign out" }).click();

    await expect(page).toHaveURL("/", { timeout: 30_000 });
    await expect(
      page
        .getByRole("navigation", { name: "Get started" })
        .getByRole("link", { name: "Create an account" }),
    ).toBeVisible();
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
    // The confirmation panel of the reset page offers this link; the visitor
    // never returns to the landing page in this journey.
    await page.getByRole("link", { name: "Sign in" }).click();
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(secondPassword);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL("/dashboard", { timeout: 30_000 });
    await expect(page.getByRole("button", { name })).toBeVisible();
  });
});
