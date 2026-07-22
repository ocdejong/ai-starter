import { expect, test } from "@playwright/test";

test("loads the typed web application", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "AI Starter" })).toBeVisible();
  await expect(page.getByText("Hello from tRPC")).toBeVisible();
});
