import { render, screen, userEvent } from "@testing-library/react-native";

import { InvitationScreen } from "./invitation-screen";
import { authClient } from "../../auth/client";
import { TestProviders } from "../../test/providers";

jest.mock("../../auth/client", () => ({
  authClient: {
    organization: {
      acceptInvitation: jest.fn(),
      getInvitation: jest.fn(),
      rejectInvitation: jest.fn(),
    },
  },
}));

const acceptInvitation = jest.mocked(authClient.organization.acceptInvitation);
const getInvitation = jest.mocked(authClient.organization.getInvitation);
const rejectInvitation = jest.mocked(authClient.organization.rejectInvitation);

async function renderScreen() {
  const onDone = jest.fn();
  const user = userEvent.setup();

  await render(
    <TestProviders>
      <InvitationScreen invitationId="invitation-1" onDone={onDone} />
    </TestProviders>,
  );

  return { onDone, user };
}

describe("InvitationScreen", () => {
  beforeEach(() => {
    acceptInvitation.mockReset();
    acceptInvitation.mockResolvedValue({ data: {}, error: null });
    rejectInvitation.mockReset();
    rejectInvitation.mockResolvedValue({ data: {}, error: null });
    getInvitation.mockReset();
    getInvitation.mockResolvedValue({
      data: {
        inviterEmail: "ada@example.com",
        organizationName: "Book Club",
        role: "member",
      },
      error: null,
    });
  });

  it("says who invited whom, to what, and in what role", async () => {
    await renderScreen();

    expect(await screen.findByText("Join Book Club")).toBeOnTheScreen();
    expect(
      screen.getByText(
        "ada@example.com invited you to join Book Club as Member.",
      ),
    ).toBeOnTheScreen();
  });

  it("joins the group and leaves the screen behind", async () => {
    const { onDone, user } = await renderScreen();
    await screen.findByText("Join Book Club");

    await user.press(screen.getByRole("button", { name: "Accept invitation" }));

    expect(acceptInvitation).toHaveBeenCalledWith({
      invitationId: "invitation-1",
    });
    expect(onDone).toHaveBeenCalled();
  });

  it("declines without joining", async () => {
    const { onDone, user } = await renderScreen();
    await screen.findByText("Join Book Club");

    await user.press(screen.getByRole("link", { name: "Decline" }));

    expect(rejectInvitation).toHaveBeenCalledWith({
      invitationId: "invitation-1",
    });
    expect(await screen.findByText("Invitation declined")).toBeOnTheScreen();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("reports a link it cannot read as one that is no longer valid", async () => {
    getInvitation.mockResolvedValue({
      data: null,
      error: { code: "BAD_REQUEST" },
    });
    await renderScreen();

    // Expired, withdrawn, already answered and addressed to someone else all
    // answer alike, so a stale link never confirms that a group exists.
    expect(
      await screen.findByText("This invitation is no longer valid"),
    ).toBeOnTheScreen();
    expect(
      screen.queryByRole("button", { name: "Accept invitation" }),
    ).toBeNull();
  });

  it("reports an invitation that is spent by the time it is accepted", async () => {
    acceptInvitation.mockResolvedValue({
      data: null,
      error: { code: "INVITATION_NOT_FOUND" },
    });
    const { onDone, user } = await renderScreen();
    await screen.findByText("Join Book Club");

    await user.press(screen.getByRole("button", { name: "Accept invitation" }));

    expect(
      await screen.findByText("This invitation is no longer valid"),
    ).toBeOnTheScreen();
    expect(onDone).not.toHaveBeenCalled();
  });
});
