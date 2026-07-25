import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IntlTestProvider } from "~/test/intl";
import { InvitationActions } from "./invitation-actions";

const mocks = vi.hoisted(() => ({
  acceptInvitation: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  rejectInvitation: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock("~/server/better-auth/client", () => ({
  authClient: {
    organization: {
      acceptInvitation: mocks.acceptInvitation,
      rejectInvitation: mocks.rejectInvitation,
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.acceptInvitation.mockResolvedValue({ data: {}, error: null });
  mocks.rejectInvitation.mockResolvedValue({ data: {}, error: null });
});

function renderActions() {
  return render(
    <IntlTestProvider>
      <InvitationActions
        groupName="Book Club"
        inviterEmail="ada@example.com"
        invitationId="invitation-1"
        role="member"
      />
    </IntlTestProvider>,
  );
}

describe("InvitationActions", () => {
  it("says who invited whom, to what, and in what role", () => {
    renderActions();

    expect(
      screen.getByRole("heading", { name: "Join Book Club" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "ada@example.com invited you to join Book Club as Member.",
      ),
    ).toBeVisible();
  });

  it("joins the group and lands on the application", async () => {
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByRole("button", { name: "Accept invitation" }));

    expect(mocks.acceptInvitation).toHaveBeenCalledWith({
      invitationId: "invitation-1",
    });
    // Accepting switches the session to the group that was joined, so the
    // dashboard is the honest destination.
    expect(mocks.push).toHaveBeenCalledWith("/dashboard");
  });

  it("declines without joining", async () => {
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByRole("button", { name: "Decline" }));

    expect(mocks.rejectInvitation).toHaveBeenCalledWith({
      invitationId: "invitation-1",
    });
    expect(
      await screen.findByRole("heading", { name: "Invitation declined" }),
    ).toBeVisible();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("reports a refused invitation as one that is no longer valid", async () => {
    const user = userEvent.setup();
    mocks.acceptInvitation.mockResolvedValue({
      data: null,
      error: { code: "INVITATION_NOT_FOUND" },
    });
    renderActions();

    await user.click(screen.getByRole("button", { name: "Accept invitation" }));

    // Expired, withdrawn and already-accepted all answer this way, and a stale
    // link must not confirm that the group exists.
    expect(
      await screen.findByRole("heading", {
        name: "This invitation is no longer valid",
      }),
    ).toBeVisible();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
