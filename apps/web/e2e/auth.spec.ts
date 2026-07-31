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
    // The first assertion after the emailed link landed on the dashboard, so it
    // waits on that page rather than merely on the URL the helper already
    // checked — the same reason every step below carries a budget.
    await expect(page.getByRole("button", { name })).toBeVisible({
      timeout: 30_000,
    });
  });

  await test.step("sign out", async () => {
    await page.getByRole("button", { name }).click();
    await page.getByRole("button", { name: "Sign out" }).click();

    await expect(page).toHaveURL("/", { timeout: 30_000 });
    // The URL commits before the landing page it names has rendered.
    await expect(
      page
        .getByRole("navigation", { name: "Get started" })
        .getByRole("link", { name: "Create an account" }),
    ).toBeVisible({ timeout: 30_000 });
  });

  await test.step("ask for a password reset", async () => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();

    // The click is a round trip that renders and writes an email before it
    // answers, and this is the first assertion behind it.
    await expect(
      page.getByRole("heading", { name: "Check your email" }),
    ).toBeVisible({ timeout: 30_000 });
  });

  await test.step("follow the reset link and choose a new password", async () => {
    await page.goto(actionUrl(await emailTo(email, 1)));

    // The emailed link is the auth server's endpoint; it checks the token and
    // redirects here with it in the query — onto a route that compiles on first
    // request against the development server.
    await expect(page).toHaveURL(/\/reset-password\?token=.+/, {
      timeout: 30_000,
    });

    await page.getByLabel("New password", { exact: true }).fill(secondPassword);
    await page
      .getByLabel("Confirm new password", { exact: true })
      .fill(secondPassword);
    await page.getByRole("button", { name: "Save new password" }).click();

    // Another round trip: the password is rewritten and every session revoked
    // before this panel replaces the form.
    await expect(
      page.getByRole("heading", { name: "Password updated" }),
    ).toBeVisible({ timeout: 30_000 });
  });

  await test.step("sign in with the new password", async () => {
    // The confirmation panel of the reset page offers this link; the visitor
    // never returns to the landing page in this journey.
    await page.getByRole("link", { name: "Sign in" }).click();
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(secondPassword);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL("/dashboard", { timeout: 30_000 });
    await expect(page.getByRole("button", { name })).toBeVisible({
      timeout: 30_000,
    });
  });
});
