import { type GroupRole } from "@ai-starter/domain";
import { render, screen, userEvent } from "@testing-library/react-native";

import { InviteForm } from "./invite-form";
import { authClient } from "../../auth/client";
import { TestProviders } from "../../test/providers";

jest.mock("../../auth/client", () => ({
  authClient: { organization: { inviteMember: jest.fn() } },
}));

const inviteMember = jest.mocked(authClient.organization.inviteMember);

async function renderForm(viewerRole: GroupRole = "owner") {
  const onInvited = jest.fn();
  const user = userEvent.setup();

  await render(
    <TestProviders>
      <InviteForm onInvited={onInvited} viewerRole={viewerRole} />
    </TestProviders>,
  );

  async function invite(email: string) {
    await user.type(screen.getByLabelText("Email address"), email);
    await user.press(screen.getByRole("button", { name: "Send invitation" }));
  }

  return { invite, onInvited, user };
}

describe("InviteForm", () => {
  beforeEach(() => {
    inviteMember.mockReset();
    inviteMember.mockResolvedValue({ data: {}, error: null });
  });

  it("invites the normalised address in the chosen role", async () => {
    const { invite, onInvited, user } = await renderForm();

    await user.press(screen.getByRole("button", { name: "Admin" }));
    await invite(" Reader@EXAMPLE.com ");

    // One address is one identity, so what reaches the server is normalised;
    // no group id is sent, because the server invites into the active group.
    expect(inviteMember).toHaveBeenCalledWith({
      email: "reader@example.com",
      role: "admin",
    });
    expect(
      screen.getByText("An invitation is on its way to reader@example.com."),
    ).toBeOnTheScreen();
    expect(onInvited).toHaveBeenCalled();
  });

  it("refuses an address that is not one without reaching the server", async () => {
    const { invite } = await renderForm();

    await invite("not-an-address");

    expect(screen.getByText("Enter a valid email address.")).toBeOnTheScreen();
    expect(inviteMember).not.toHaveBeenCalled();
  });

  it("offers an admin only the roles an admin may hand out", async () => {
    await renderForm("admin");

    expect(screen.queryByRole("button", { name: "Owner" })).toBeNull();
    expect(screen.getByRole("button", { name: "Admin" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Member" })).toBeOnTheScreen();
  });

  it("says who is already a member rather than repeating the server", async () => {
    inviteMember.mockResolvedValue({
      data: null,
      error: { code: "USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION" },
    });
    const { invite, onInvited } = await renderForm();

    await invite("reader@example.com");

    expect(
      screen.getByText("That person is already in this group."),
    ).toBeOnTheScreen();
    expect(onInvited).not.toHaveBeenCalled();
  });
});
