import { type GroupRole } from "@ai-starter/domain";
import {
  render,
  screen,
  userEvent,
  within,
} from "@testing-library/react-native";

import { MembersList, type GroupMemberView } from "./members-list";
import { authClient } from "../../auth/client";
import { TestProviders } from "../../test/providers";

jest.mock("../../auth/client", () => ({
  authClient: {
    organization: { removeMember: jest.fn(), updateMemberRole: jest.fn() },
  },
}));

const removeMember = jest.mocked(authClient.organization.removeMember);
const updateMemberRole = jest.mocked(authClient.organization.updateMemberRole);

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

async function renderList(viewerRole: GroupRole) {
  const onChanged = jest.fn();
  const user = userEvent.setup();

  await render(
    <TestProviders>
      <MembersList
        members={members}
        onChanged={onChanged}
        viewerRole={viewerRole}
        viewerUserId="user-1"
      />
    </TestProviders>,
  );

  return { onChanged, user };
}

describe("MembersList", () => {
  beforeEach(() => {
    removeMember.mockReset();
    removeMember.mockResolvedValue({ data: {}, error: null } as never);
    updateMemberRole.mockReset();
    updateMemberRole.mockResolvedValue({ data: {}, error: null } as never);
  });

  it("lists every member and marks the reader's own row", async () => {
    await renderList("owner");

    expect(screen.getByText("Ada Lovelace (You)")).toBeOnTheScreen();
    expect(screen.getByText("alan@example.com")).toBeOnTheScreen();
  });

  it("changes a member's role through the group the session already names", async () => {
    const { onChanged, user } = await renderList("owner");

    await user.press(
      within(screen.getByLabelText("Role of Alan Turing")).getByRole("button", {
        name: "Admin",
      }),
    );

    expect(updateMemberRole).toHaveBeenCalledWith({
      memberId: "member-2",
      role: "admin",
    });
    expect(onChanged).toHaveBeenCalled();
  });

  it("withholds the owner role from an admin, who may not hand it out", async () => {
    await renderList("admin");

    const roles = screen.getByLabelText("Role of Alan Turing");
    expect(within(roles).queryByRole("button", { name: "Owner" })).toBeNull();
    expect(
      within(roles).getByRole("button", { name: "Admin" }),
    ).toBeOnTheScreen();
  });

  it("gives a plain member no way to change or remove anyone", async () => {
    await renderList("member");

    expect(screen.queryByLabelText("Role of Alan Turing")).toBeNull();
    expect(screen.queryByLabelText("Remove Alan Turing")).toBeNull();
    // Knowing who is in your own group is not a privilege; acting on them is.
    expect(screen.getByText("alan@example.com")).toBeOnTheScreen();
  });

  it("asks before removing someone, and only then removes them", async () => {
    const { user } = await renderList("owner");

    await user.press(screen.getByLabelText("Remove Alan Turing"));
    expect(removeMember).not.toHaveBeenCalled();
    expect(
      screen.getByText("Remove Alan Turing from this group?"),
    ).toBeOnTheScreen();

    await user.press(screen.getByRole("button", { name: "Yes, remove" }));

    expect(removeMember).toHaveBeenCalledWith({ memberIdOrEmail: "member-2" });
  });
});
