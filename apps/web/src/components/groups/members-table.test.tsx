import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IntlTestProvider } from "~/test/intl";
import { MembersTable, type GroupMemberView } from "./members-table";

const mocks = vi.hoisted(() => ({
  removeMember: vi.fn(),
  updateMemberRole: vi.fn(),
}));

vi.mock("~/server/better-auth/client", () => ({
  authClient: {
    organization: {
      removeMember: mocks.removeMember,
      updateMemberRole: mocks.updateMemberRole,
    },
  },
}));

const members: GroupMemberView[] = [
  {
    id: "member-1",
    role: "owner",
    user: { email: "ada@example.com", id: "user-1", name: "Ada Lovelace" },
  },
  {
    id: "member-2",
    role: "member",
    user: { email: "alan@example.com", id: "user-2", name: "Alan Turing" },
  },
];

const onChanged = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mocks.removeMember.mockResolvedValue({ data: {}, error: null });
  mocks.updateMemberRole.mockResolvedValue({ data: {}, error: null });
});

function renderTable(viewerRole: "owner" | "admin" | "member") {
  return render(
    <IntlTestProvider>
      <MembersTable
        members={members}
        onChanged={onChanged}
        viewerRole={viewerRole}
        viewerUserId="user-1"
      />
    </IntlTestProvider>,
  );
}

describe("MembersTable", () => {
  it("lists every member with their role and marks the reader's own row", () => {
    renderTable("owner");

    const ownRow = screen.getByRole("row", { name: /Ada Lovelace/ });
    expect(within(ownRow).getByText("You", { exact: false })).toBeVisible();
    expect(within(ownRow).getByText("Owner")).toBeVisible();
    expect(
      within(screen.getByRole("row", { name: /Alan Turing/ })).getByText(
        "alan@example.com",
      ),
    ).toBeVisible();
  });

  it("changes a member's role through the group the session already names", async () => {
    const user = userEvent.setup();
    renderTable("owner");

    await user.selectOptions(
      screen.getByLabelText("Role of Alan Turing"),
      "admin",
    );

    // No group id is sent: the server resolves the active group and re-derives
    // the caller's membership in it.
    expect(mocks.updateMemberRole).toHaveBeenCalledWith({
      memberId: "member-2",
      role: "admin",
    });
    expect(onChanged).toHaveBeenCalled();
  });

  it("withholds the owner role from an admin, who may not hand it out", () => {
    renderTable("admin");

    const roles = Array.from(
      screen.getByLabelText("Role of Alan Turing").querySelectorAll("option"),
    ).map((option) => option.textContent);
    expect(roles).toEqual(["Admin", "Member"]);
  });

  it("gives a plain member no way to change or remove anyone", () => {
    renderTable("member");

    expect(screen.queryByLabelText("Role of Alan Turing")).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    // The rows are still readable — knowing who is in your own group is not a
    // privilege, acting on them is.
    expect(screen.getByText("Alan Turing")).toBeVisible();
  });

  it("asks before removing someone, and only then removes them", async () => {
    const user = userEvent.setup();
    renderTable("owner");

    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(mocks.removeMember).not.toHaveBeenCalled();
    expect(
      screen.getByText("Remove Alan Turing from this group?"),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Yes, remove" }));

    expect(mocks.removeMember).toHaveBeenCalledWith({
      memberIdOrEmail: "member-2",
    });
    expect(onChanged).toHaveBeenCalled();
  });

  it("explains a refusal in the reader's terms instead of the server's", async () => {
    const user = userEvent.setup();
    mocks.updateMemberRole.mockResolvedValue({
      data: null,
      error: { code: "YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_MEMBER" },
    });
    renderTable("owner");

    await user.selectOptions(
      screen.getByLabelText("Role of Alan Turing"),
      "admin",
    );

    expect(
      await screen.findByText("Your role in this group does not allow that."),
    ).toBeVisible();
  });
});
