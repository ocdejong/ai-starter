import { expect, test } from "@playwright/test";

test("tells a visitor what this is and how to get in", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "AI Starter" })).toBeVisible();
  await expect(
    page.getByText("A full-stack starter your coding agents can extend."),
  ).toBeVisible();

  // Scoped to the landing page's own call to action: the chat demo below offers
  // a second, differently-meant "Sign in" link.
  const ways = page.getByRole("navigation", { name: "Get started" });
  await expect(
    ways.getByRole("link", { name: "Create an account" }),
  ).toHaveAttribute("href", "/sign-up");
  await expect(ways.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/sign-in",
  );

  await expect(
    page.getByRole("heading", { name: "Ask the assistant" }),
  ).toBeVisible();
});
