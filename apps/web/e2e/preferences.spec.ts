import { expect, test } from "@playwright/test";

// The controls are public. Persistence needs a real reload, but no account,
// email round trip or protected route is involved in either preference.
test("keeps language and theme across a reload", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Nederlands" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "nl");

  await page.reload();

  await expect(page.locator("html")).toHaveAttribute("lang", "nl");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.getByRole("group", { name: "Taal" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Nederlands" }),
  ).toHaveAttribute("aria-pressed", "true");
});
