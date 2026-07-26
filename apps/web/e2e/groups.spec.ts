import { expect, test, type Page } from "@playwright/test";

import { registerVerifiedAccount } from "./support/account";
import { actionUrl, emailTo } from "./support/mailbox";

// Two accounts, an emailed link and several route compilations against the
// development server; the default per-test budget is not enough for that.
test.setTimeout(240_000);

/** The id of the group the session is currently working in. */
async function activeGroupId(page: Page, name: string): Promise<string> {
  const response = await page.request.get("/api/auth/organization/list");
  expect(response.ok()).toBe(true);
  const groups = (await response.json()) as { id: string; name: string }[];
  const group = groups.find((candidate) => candidate.name === name);
  if (group === undefined) {
    throw new Error(`No group named ${name} for this session.`);
  }
  return group.id;
}

test("an owner invites, promotes and removes a member", async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await registerVerifiedAccount(owner, { name: "Ada Lovelace" });

  // A new account already has its personal group, so the switcher is there
  // before this journey creates anything.
  await owner.goto("/settings/group");
  await expect(owner.getByLabel("Active group")).toHaveValue(/.+/, {
    timeout: 30_000,
  });

  await owner.getByLabel("Name of the new group").fill("Book Club");
  await owner.getByRole("button", { name: "Create group" }).click();
  // Creating a group switches to it, which is what the switcher and the name
  // field both have to agree about.
  await expect(owner.getByLabel("Group name")).toHaveValue("Book Club", {
    timeout: 30_000,
  });
  await expect(owner.locator("#group-switcher option:checked")).toHaveText(
    "Book Club",
  );

  const memberContext = await browser.newContext();
  const member = await memberContext.newPage();
  const memberAccount = await registerVerifiedAccount(member, {
    name: "Alan Turing",
  });

  await owner.getByLabel("Email address").fill(memberAccount.email);
  await owner.getByRole("button", { name: "Send invitation" }).click();
  await expect(
    owner.getByText(`An invitation is on its way to ${memberAccount.email}.`),
  ).toBeVisible({ timeout: 30_000 });
  await expect(owner.getByRole("button", { name: "Withdraw" })).toBeVisible();

  // The invitation is the second message this address receives: the first was
  // the confirmation link that created the account.
  await member.goto(actionUrl(await emailTo(memberAccount.email, 1)));
  await member.getByRole("button", { name: "Accept invitation" }).click();
  // Accepting joins the group and switches the session to it.
  await expect(member).toHaveURL("/dashboard", { timeout: 30_000 });
  await expect(member.locator("#group-switcher option:checked")).toHaveText(
    "Book Club",
  );

  await owner.reload();
  const memberRow = owner.getByRole("row", { name: /Alan Turing/ });
  await expect(memberRow).toBeVisible({ timeout: 30_000 });
  await expect(owner.getByLabel("Role of Alan Turing")).toHaveValue("member");
  // The invitation has been answered, so it no longer waits for one.
  await expect(
    owner.getByText("Nobody is waiting for an answer."),
  ).toBeVisible();

  await owner.getByLabel("Role of Alan Turing").selectOption("admin");
  // The select stays disabled while the role change is in flight, and under
  // load that outlives the default expect budget.
  await expect(owner.getByLabel("Role of Alan Turing")).toHaveValue("admin", {
    timeout: 30_000,
  });

  // Switching is the one thing only a browser can prove: the choice is written
  // into the session, and the page has to come back showing the other group
  // rather than a stale name and someone else's members.
  await owner
    .getByLabel("Active group")
    .selectOption({ label: "Ada Lovelace" });
  await expect(owner.getByLabel("Group name")).toHaveValue("Ada Lovelace", {
    timeout: 30_000,
  });
  // The members table refetches from a different store than the name field, so
  // the wait above says nothing about this one — and the default 5 seconds is
  // the whole margin for a mutation that finishes with a client refetch.
  await expect(owner.getByRole("row", { name: /Alan Turing/ })).toHaveCount(0, {
    timeout: 30_000,
  });

  await owner.getByLabel("Active group").selectOption({ label: "Book Club" });
  await expect(owner.getByLabel("Group name")).toHaveValue("Book Club", {
    timeout: 30_000,
  });
  await expect(owner.getByRole("row", { name: /Alan Turing/ })).toBeVisible();

  await owner.getByRole("button", { name: "Remove" }).click();
  await owner.getByRole("button", { name: "Yes, remove" }).click();
  // The row only leaves once the removal and the refresh complete, which
  // under load outlives the default expect budget.
  await expect(owner.getByRole("row", { name: /Alan Turing/ })).toHaveCount(0, {
    timeout: 30_000,
  });

  // Deleting the active group leaves the session without one, so the page has
  // to re-point it at what the account still belongs to.
  await owner.getByRole("button", { name: "Delete group" }).click();
  await owner.getByRole("button", { name: "Yes, continue" }).click();
  await expect(owner.getByLabel("Group name")).toHaveValue("Ada Lovelace", {
    timeout: 30_000,
  });
  // Same shape: the switcher's list refetches separately from the active group.
  await expect(
    owner.locator("#group-switcher option", { hasText: "Book Club" }),
  ).toHaveCount(0, { timeout: 30_000 });

  await ownerContext.close();
  await memberContext.close();
});

test("a plain member is refused the group's owner actions", async ({
  browser,
  baseURL,
}) => {
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await registerVerifiedAccount(owner, { name: "Grace Hopper" });

  await owner.goto("/settings/group");
  await owner
    .getByLabel("Name of the new group")
    .fill("Guarded", { timeout: 30_000 });
  await owner.getByRole("button", { name: "Create group" }).click();
  await expect(owner.getByLabel("Group name")).toHaveValue("Guarded", {
    timeout: 30_000,
  });

  const memberContext = await browser.newContext();
  const member = await memberContext.newPage();
  const memberAccount = await registerVerifiedAccount(member, {
    name: "Katherine Johnson",
  });

  await owner.getByLabel("Email address").fill(memberAccount.email);
  await owner.getByRole("button", { name: "Send invitation" }).click();
  await expect(
    owner.getByText(`An invitation is on its way to ${memberAccount.email}.`),
  ).toBeVisible({ timeout: 30_000 });

  await member.goto(actionUrl(await emailTo(memberAccount.email, 1)));
  await member.getByRole("button", { name: "Accept invitation" }).click();
  await expect(member).toHaveURL("/dashboard", { timeout: 30_000 });

  await member.goto("/settings/group");
  await expect(member.getByText("Members")).toBeVisible({ timeout: 30_000 });
  // A member reads the group and its people; every affordance that changes them
  // is absent.
  await expect(
    member.getByText("Only an owner or an admin can rename this group."),
  ).toBeVisible();
  await expect(member.getByLabel("Group name")).toHaveCount(0);
  await expect(
    member.getByRole("button", { name: "Send invitation" }),
  ).toHaveCount(0);
  await expect(
    member.getByRole("button", { name: "Delete group" }),
  ).toHaveCount(0);
  await expect(member.getByRole("button", { name: "Remove" })).toHaveCount(0);

  // The absent buttons are a courtesy; this is the boundary. The member's own
  // session asks the auth server directly and is refused.
  const groupId = await activeGroupId(member, "Guarded");
  const headers = { origin: baseURL ?? "" };
  const deletion = await member.request.post("/api/auth/organization/delete", {
    data: { organizationId: groupId },
    headers,
  });
  expect(deletion.status()).toBe(403);
  const invitation = await member.request.post(
    "/api/auth/organization/invite-member",
    {
      data: {
        email: "outsider@example.com",
        organizationId: groupId,
        role: "member",
      },
      headers,
    },
  );
  expect(invitation.status()).toBe(403);
  const rename = await member.request.post("/api/auth/organization/update", {
    data: { data: { name: "Renamed" }, organizationId: groupId },
    headers,
  });
  expect(rename.status()).toBe(403);

  // Nothing the member attempted took effect.
  await owner.reload();
  await expect(owner.getByLabel("Group name")).toHaveValue("Guarded", {
    timeout: 30_000,
  });
  await expect(
    owner.getByText("Nobody is waiting for an answer."),
  ).toBeVisible();

  // What a member may do is leave. That clears the session's active group, so
  // the page has to put them back in the one group they still have.
  await member.getByRole("button", { name: "Leave group" }).click();
  await member.getByRole("button", { name: "Yes, continue" }).click();
  await expect(
    member.getByText("Only an owner or an admin can rename this group."),
  ).toHaveCount(0, { timeout: 30_000 });
  await expect(member.getByLabel("Group name")).toHaveValue(
    "Katherine Johnson",
  );
  await owner.reload();
  await expect(
    owner.getByRole("row", { name: /Katherine Johnson/ }),
  ).toHaveCount(0, { timeout: 30_000 });

  await ownerContext.close();
  await memberContext.close();
});
