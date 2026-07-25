import { expect, type Page } from "@playwright/test";

import { actionUrl, emailTo } from "./mailbox";

export type TestAccount = {
  readonly email: string;
  readonly name: string;
  readonly password: string;
};

/**
 * Registers an account and confirms it through the emailed link, leaving the
 * browser signed in on the dashboard.
 *
 * Every journey that needs a signed-in browser needs this, and it is the one
 * place that knows the confirmation link signs the visitor in — so the specs
 * that follow assert what they are about rather than re-deriving registration.
 */
export async function registerVerifiedAccount(
  page: Page,
): Promise<TestAccount> {
  const account: TestAccount = {
    email: `ada-${String(Date.now())}-${String(Math.floor(Math.random() * 1e6))}@example.com`,
    name: "Ada Lovelace",
    password: "the first correct password",
  };

  await page.goto("/sign-up");
  await page.getByLabel("Name", { exact: true }).fill(account.name);
  await page.getByLabel("Email address", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Create account" }).click();

  // Registration renders and writes the confirmation email before it answers,
  // and against the development server this is the request that first compiles
  // that path — so it gets a longer leash than the default assertion timeout.
  await expect(
    page.getByRole("heading", { name: "Confirm your email address" }),
  ).toBeVisible({ timeout: 30_000 });

  await page.goto(actionUrl(await emailTo(account.email, 0)));

  // Confirming signs the account in, so the auth layout sends it to the
  // application rather than back to a form it no longer needs.
  await expect(page).toHaveURL("/dashboard");

  return account;
}
