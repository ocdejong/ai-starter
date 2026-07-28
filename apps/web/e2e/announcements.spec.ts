import { expect, test } from "@playwright/test";

import { registerVerifiedAccount } from "./support/account";

/**
 * The example feature slice, driven end to end.
 *
 * This is the journey a generated feature is worth: it is the only check that
 * runs the whole stack the generator emits — the form's schema, the procedure's
 * group scoping, the transaction, and the PostgreSQL constraint behind it —
 * against a real browser and a real database.
 */
test("publishes, renames and supersedes a group's announcements", async ({
  page,
}) => {
  // Registration, a mailbox round trip, and several routes that each compile on
  // first request against the development server.
  test.setTimeout(180_000);

  await registerVerifiedAccount(page);

  await test.step("a new group has nothing to show", async () => {
    await page.getByRole("link", { name: "Announcements" }).click();

    await expect(page).toHaveURL("/announcements", { timeout: 30_000 });
    await expect(
      page.getByText("This group has not published anything yet."),
    ).toBeVisible({ timeout: 30_000 });
  });

  await test.step("publish the first one", async () => {
    await page.getByLabel("New title").fill("The first announcement");
    await page.getByRole("button", { name: "Publish" }).click();

    await expect(page.getByLabel("Current title")).toHaveValue(
      "The first announcement",
      { timeout: 30_000 },
    );
    await expect(page.getByText("1 announcement")).toBeVisible();
  });

  await test.step("rename it", async () => {
    await page.getByLabel("Current title").fill("The renamed announcement");
    await page.getByRole("button", { name: "Save" }).click();

    // The first assertion after a click waits on the round trip, so it gets the
    // same budget as every other one in this file. It is the only one that ever
    // ran on the 5s default, and a weekly sensor that fails on a slow mutation
    // is a red nobody can read.
    await expect(page.getByText("Saved.")).toBeVisible({ timeout: 30_000 });
    await page.reload();
    await expect(page.getByLabel("Current title")).toHaveValue(
      "The renamed announcement",
      { timeout: 30_000 },
    );
  });

  await test.step("publishing again supersedes it", async () => {
    await page.getByLabel("New title").fill("A second announcement");
    await page.getByRole("button", { name: "Publish" }).click();

    // The field is seeded from the current announcement, so this assertion is
    // what catches a form that was not keyed by the record it is about: every
    // unit test passes while it shows the previous title.
    await expect(page.getByLabel("Current title")).toHaveValue(
      "A second announcement",
      { timeout: 30_000 },
    );
    await expect(
      page
        .getByRole("region", { name: "Earlier announcements" })
        .getByText("The renamed announcement"),
    ).toBeVisible();
    await expect(page.getByText("2 announcements")).toBeVisible();
  });
});

test("keeps one group's announcements out of another's", async ({
  browser,
}) => {
  test.setTimeout(180_000);

  const owner = await browser.newContext();
  const stranger = await browser.newContext();

  try {
    const ownerPage = await owner.newPage();
    await registerVerifiedAccount(ownerPage, { name: "Ada Lovelace" });
    await ownerPage.goto("/announcements");
    await ownerPage.getByLabel("New title").fill("This group's announcement");
    await ownerPage.getByRole("button", { name: "Publish" }).click();
    await expect(ownerPage.getByLabel("Current title")).toHaveValue(
      "This group's announcement",
      { timeout: 30_000 },
    );

    // A second account signs up into its own personal group. The procedures
    // take no group identifier, so there is nothing for this reader to tamper
    // with — and the group behind their session has no announcements.
    const strangerPage = await stranger.newPage();
    await registerVerifiedAccount(strangerPage, { name: "Grace Hopper" });
    await strangerPage.goto("/announcements");

    await expect(
      strangerPage.getByText("This group has not published anything yet."),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      strangerPage.getByText("This group's announcement"),
    ).toHaveCount(0);
  } finally {
    await owner.close();
    await stranger.close();
  }
});
