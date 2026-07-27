import { expect, test } from "@playwright/test";

import { registerVerifiedAccount } from "./support/account";

/**
 * Language and theme, driven the way a person drives them.
 *
 * Both were covered only by component tests, which render one locale and one
 * theme and cannot see what these two controls actually do: the language switch
 * is a server action writing a cookie that the *server* tree is then re-rendered
 * against, and the theme switch is a class on `<html>` that has to survive a
 * reload. Neither fact is observable without a browser, and stage 12 recorded
 * the gap when it shipped the group pages without ever pointing one at Dutch.
 *
 * Each half asserts the reload, because persistence is the half that breaks: a
 * switch that only repaints the current page is exactly the bug a single-render
 * test cannot fail on.
 */
test.describe("language and theme", () => {
  test("switches to Dutch and keeps it across a reload", async ({ page }) => {
    await registerVerifiedAccount(page);

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();

    await page
      .getByRole("group", { name: "Language" })
      .getByRole("button", { name: "Nederlands" })
      .click();

    // The server action writes the cookie and `router.refresh()` re-renders the
    // server tree, so the proof is server-rendered markup in Dutch — the `lang`
    // attribute comes from the root layout — and not merely a client label.
    await expect(page.locator("html")).toHaveAttribute("lang", "nl", {
      timeout: 30_000,
    });
    await expect(
      page.getByRole("link", { name: "Instellingen" }),
    ).toBeVisible();
    await expect(page.getByRole("group", { name: "Taal" })).toBeVisible();

    await page.reload();

    await expect(page.locator("html")).toHaveAttribute("lang", "nl");
    await expect(
      page.getByRole("link", { name: "Instellingen" }),
    ).toBeVisible();
  });

  test("turns the theme dark and keeps it across a reload", async ({
    page,
  }) => {
    await registerVerifiedAccount(page);

    await expect(page.locator("html")).not.toHaveClass(/dark/);

    await page
      .getByRole("group", { name: "Theme" })
      .getByRole("button", { name: "Dark" })
      .click();

    await expect(page.locator("html")).toHaveClass(/dark/);

    await page.reload();

    // next-themes persists the choice and re-applies it before paint, so a
    // reload that came back light would mean the stored preference never
    // reached the document.
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByRole("button", { name: "Dark" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
