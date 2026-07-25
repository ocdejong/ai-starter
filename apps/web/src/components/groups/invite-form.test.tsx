import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IntlTestProvider } from "~/test/intl";
import { InviteForm } from "./invite-form";

const mocks = vi.hoisted(() => ({ inviteMember: vi.fn() }));

vi.mock("~/server/better-auth/client", () => ({
  authClient: { organization: { inviteMember: mocks.inviteMember } },
}));

const onChanged = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mocks.inviteMember.mockResolvedValue({ data: {}, error: null });
});

function renderForm(viewerRole: "owner" | "admin" = "owner") {
  return render(
    <IntlTestProvider>
      <InviteForm onChanged={onChanged} viewerRole={viewerRole} />
    </IntlTestProvider>,
  );
}

describe("InviteForm", () => {
  it("invites the normalised address with the chosen role", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(
      screen.getByLabelText("Email address"),
      " Reader@EXAMPLE.com ",
    );
    await user.selectOptions(screen.getByLabelText("Role"), "admin");
    await user.click(screen.getByRole("button", { name: "Send invitation" }));

    // One address is one identity, so what reaches the server is normalised;
    // no group id is sent, because the server invites into the active group.
    expect(mocks.inviteMember).toHaveBeenCalledWith({
      email: "reader@example.com",
      role: "admin",
    });
    expect(
      await screen.findByText(
        "An invitation is on its way to reader@example.com.",
      ),
    ).toBeVisible();
    expect(onChanged).toHaveBeenCalled();
  });

  it("refuses an address that is not one without reaching the server", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Email address"), "not-an-address");
    await user.click(screen.getByRole("button", { name: "Send invitation" }));

    expect(
      await screen.findByText("Enter a valid email address."),
    ).toBeVisible();
    expect(mocks.inviteMember).not.toHaveBeenCalled();
  });

  it("offers an admin only the roles an admin may hand out", () => {
    renderForm("admin");

    expect(
      Array.from(screen.getByLabelText("Role").querySelectorAll("option")).map(
        (option) => option.textContent,
      ),
    ).toEqual(["Admin", "Member"]);
  });

  it("says who is already a member rather than repeating the server", async () => {
    const user = userEvent.setup();
    mocks.inviteMember.mockResolvedValue({
      data: null,
      error: { code: "USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION" },
    });
    renderForm();

    await user.type(
      screen.getByLabelText("Email address"),
      "reader@example.com",
    );
    await user.click(screen.getByRole("button", { name: "Send invitation" }));

    expect(
      await screen.findByText("That person is already in this group."),
    ).toBeVisible();
    expect(onChanged).not.toHaveBeenCalled();
  });
});
