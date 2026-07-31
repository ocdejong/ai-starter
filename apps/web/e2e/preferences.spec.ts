import { expect, test } from "@playwright/test";

import { registerVerifiedAccount } from "./support/account";

// Both halves register through the mailbox and reload a route that compiles on
// first request, which is the same journey every other spec here gives itself
// room for. Without this the per-test default is 30 seconds, so a single
// assertion allowed 30 could never actually spend it.
test.setTimeout(180_000);

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

    // The first assertions after the emailed link landed on the dashboard.
    await expect(page.locator("html")).toHaveAttribute("lang", "en", {
      timeout: 30_000,
    });
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible({
      timeout: 30_000,
    });

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

    // The reload is a fresh server render against the cookie the action wrote.
    await expect(page.locator("html")).toHaveAttribute("lang", "nl", {
      timeout: 30_000,
    });
    await expect(
      page.getByRole("link", { name: "Instellingen" }),
    ).toBeVisible();
  });

  test("turns the theme dark and keeps it across a reload", async ({
    page,
  }) => {
    await registerVerifiedAccount(page);

    // A positive assertion first: `not.toHaveClass` would also be satisfied by a
    // page that has not rendered yet, which is no starting point for the two
    // assertions below.
    await expect(page.getByRole("group", { name: "Theme" })).toBeVisible({
      timeout: 30_000,
    });
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
    await expect(page.locator("html")).toHaveClass(/dark/, { timeout: 30_000 });
    // The class arrives from a blocking script; this one needs the control to
    // have hydrated, which is a later moment on a loaded dev server.
    await expect(page.getByRole("button", { name: "Dark" })).toHaveAttribute(
      "aria-pressed",
      "true",
      { timeout: 30_000 },
    );
  });
});
