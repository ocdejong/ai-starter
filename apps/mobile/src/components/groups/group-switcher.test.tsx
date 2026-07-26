import { render, screen, userEvent } from "@testing-library/react-native";

import { GroupSwitcher } from "./group-switcher";
import { authClient } from "../../auth/client";
import { TestProviders } from "../../test/providers";

jest.mock("../../auth/client", () => ({
  authClient: { organization: { setActive: jest.fn() } },
}));

const setActive = jest.mocked(authClient.organization.setActive);

const groups = [
  { id: "group-1", name: "Ada Lovelace" },
  { id: "group-2", name: "Book Club" },
];

async function renderSwitcher(activeGroupId: string | null = "group-1") {
  const onSwitched = jest.fn();
  const user = userEvent.setup();

  await render(
    <TestProviders>
      <GroupSwitcher
        activeGroupId={activeGroupId}
        groups={groups}
        onSwitched={onSwitched}
      />
    </TestProviders>,
  );

  return { onSwitched, user };
}

describe("GroupSwitcher", () => {
  beforeEach(() => {
    setActive.mockReset();
    setActive.mockResolvedValue({ data: {}, error: null });
  });

  it("offers every group and marks the active one", async () => {
    await renderSwitcher();

    expect(
      screen.getByRole("button", { name: "Ada Lovelace", selected: true }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole("button", { name: "Book Club", selected: false }),
    ).toBeOnTheScreen();
  });

  it("switches to the group that was pressed", async () => {
    const { onSwitched, user } = await renderSwitcher();

    await user.press(screen.getByRole("button", { name: "Book Club" }));

    expect(setActive).toHaveBeenCalledWith({ organizationId: "group-2" });
    // The switch changes what every other screen resolves, so they are asked
    // again rather than left showing the group that was just left behind.
    expect(onSwitched).toHaveBeenCalled();
  });

  it("says what happened when the switch is refused", async () => {
    setActive.mockResolvedValue({
      data: null,
      error: { code: "USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION" },
    });
    const { onSwitched, user } = await renderSwitcher();

    await user.press(screen.getByRole("button", { name: "Book Club" }));

    expect(
      await screen.findByText("Your role in this group does not allow that."),
    ).toBeOnTheScreen();
    expect(onSwitched).not.toHaveBeenCalled();
  });

  it("renders nothing when there is no group to switch between", async () => {
    const onSwitched = jest.fn();

    await render(
      <TestProviders>
        <GroupSwitcher
          activeGroupId={null}
          groups={[]}
          onSwitched={onSwitched}
        />
      </TestProviders>,
    );

    expect(screen.queryByText("Active group")).toBeNull();
  });
});
