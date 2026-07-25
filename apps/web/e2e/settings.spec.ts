import { expect, test, type Browser, type Page } from "@playwright/test";

import { registerVerifiedAccount, type TestAccount } from "./support/account";
import { actionUrl, emailTo } from "./support/mailbox";

/**
 * A second browser context signed in to the same account.
 *
 * Sessions are the point of these journeys, and one page can only ever hold one:
 * proving that revoking a session ends it needs a second, genuinely separate
 * cookie jar to end. Registration already confirmed the address, so this only
 * signs in.
 */
async function signInElsewhere(
  browser: Browser,
  account: TestAccount,
): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("/sign-in");
  await page.getByLabel("Email address", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/dashboard", { timeout: 30_000 });

  return page;
}

async function expectSignedOut(page: Page): Promise<void> {
  await page.goto("/dashboard");
  await expect(page).toHaveURL("/sign-in", { timeout: 30_000 });
}

test("lists the account's sessions and ends the one that is chosen", async ({
  browser,
  page,
}) => {
  test.setTimeout(180_000);

  const account = await registerVerifiedAccount(page);
  const other = await signInElsewhere(browser, account);

  await page.goto("/settings/account");
  const sessions = page.getByRole("region", { name: "Active sessions" });

  await test.step("both devices are listed, and this one is named", async () => {
    await expect(sessions.getByText("This device")).toBeVisible({
      timeout: 30_000,
    });
    await expect(sessions.getByRole("listitem")).toHaveCount(2);
    // The browser's real user agent reached the device reader and came back as
    // something; naming which browser would only assert what this runner is.
    await expect(sessions.getByText("Unrecognised device")).toHaveCount(0);
  });

  await test.step("signing a row out ends exactly that session", async () => {
    const rows = sessions.getByRole("listitem");
    await rows
      .filter({ hasNot: page.getByText("This device") })
      .first()
      .getByRole("button", { name: "Sign out" })
      .click();

    await expect(sessions.getByRole("listitem")).toHaveCount(1);
  });

  await test.step("the caller is still signed in", async () => {
    await page.reload();
    await expect(page).toHaveURL(/\/settings\/account/);
  });

  await other.context().close();
});

test("changes the password, ending the other devices but not this one", async ({
  browser,
  page,
}) => {
  test.setTimeout(180_000);

  const account = await registerVerifiedAccount(page);
  const other = await signInElsewhere(browser, account);
  const newPassword = "a second entirely correct password";

  await page.goto("/settings/account");
  await page
    .getByLabel("Current password", { exact: true })
    .fill(account.password);
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page
    .getByLabel("Confirm new password", { exact: true })
    .fill(newPassword);
  await page.getByLabel("Sign out my other devices").check();
  await page.getByRole("button", { name: "Change password" }).click();

  await expect(page.getByText("Your password has been changed.")).toBeVisible({
    timeout: 30_000,
  });

  await test.step("the other device is signed out", async () => {
    await expectSignedOut(other);
  });

  await test.step("this device is not — the server re-issued its session", async () => {
    // Revoking the others ends *every* session and sets a replacement cookie;
    // the browser follows it, which is why the reader stays where they are.
    await page.reload();
    await expect(page).toHaveURL(/\/settings\/account/);
    await expect(
      page
        .getByRole("region", { name: "Active sessions" })
        .getByText("This device"),
    ).toBeVisible();
  });

  await other.context().close();
});

test("changes the email address across both of its links", async ({ page }) => {
  test.setTimeout(180_000);

  const account = await registerVerifiedAccount(page);
  const newEmail = `grace-${String(Date.now())}@example.com`;

  await page.goto("/settings/account");
  await page.getByLabel("New email address").fill(newEmail);
  await page.getByRole("button", { name: "Send confirmation link" }).click();

  await test.step("the confirmation names both inboxes", async () => {
    const notice = page.getByRole("status");
    await expect(notice).toContainText(account.email, { timeout: 30_000 });
    await expect(notice).toContainText(newEmail);
  });

  await test.step("the first link goes to the address on the account", async () => {
    // Message 0 was the registration confirmation, so this is message 1.
    await page.goto(actionUrl(await emailTo(account.email, 1)));

    await expect(page).toHaveURL(/\/settings\/account\?emailChange=confirmed/);
    await expect(page.getByText(account.email)).toBeVisible();
  });

  await test.step("the second link, in the new inbox, is what moves the account", async () => {
    await page.goto(actionUrl(await emailTo(newEmail, 0)));

    await expect(page).toHaveURL(/\/settings\/account\?emailChange=confirmed/);
    await expect(page.getByText(newEmail)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(account.email)).toHaveCount(0);
  });
});

test("deletes the account only after the emailed link is opened", async ({
  page,
}) => {
  test.setTimeout(180_000);

  const account = await registerVerifiedAccount(page);

  await page.goto("/settings/account");
  const danger = page.getByRole("region", { name: "Delete account" });
  await danger.getByRole("button", { name: "Delete account" }).click();

  await test.step("the deletion waits for the account's own address", async () => {
    await expect(
      danger.getByRole("button", { name: "Permanently delete account" }),
    ).toBeDisabled();

    await danger.getByLabel("Your email address").fill(account.email);
    await danger
      .getByRole("button", { name: "Permanently delete account" })
      .click();
  });

  await test.step("the request only sends mail; the account survives it", async () => {
    await expect(danger.getByRole("status")).toContainText(
      "Nothing has been deleted yet.",
      { timeout: 30_000 },
    );

    await page.reload();
    await expect(page).toHaveURL(/\/settings\/account/);
  });

  await test.step("opening the link deletes the account and ends the session", async () => {
    await page.goto(actionUrl(await emailTo(account.email, 1)));

    await expect(page).toHaveURL("/", { timeout: 30_000 });
    await expectSignedOut(page);
  });

  await test.step("the credentials no longer belong to anyone", async () => {
    await page.goto("/sign-in");
    await page.getByLabel("Email address", { exact: true }).fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(
      page.getByText(
        "That email address and password do not match an account.",
      ),
    ).toBeVisible({ timeout: 30_000 });
  });
});
