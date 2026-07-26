import { render, screen, userEvent } from "@testing-library/react-native";

import { TestProviders } from "../../test/providers";
import { AnnouncementPanel, type Announcement } from "./announcement-panel";

const current: Announcement = {
  id: "announcement-1",
  isCurrent: true,
  title: "Office closed on Friday",
};
const superseded: Announcement = {
  id: "announcement-0",
  isCurrent: false,
  title: "Standup at 09:30",
};

type PanelProps = Parameters<typeof AnnouncementPanel>[0];

function props(overrides: Partial<PanelProps> = {}): PanelProps {
  return {
    announcements: [current, superseded],
    failure: null,
    isPublishing: false,
    isRenaming: false,
    onPublish: jest.fn(),
    onRename: jest.fn(),
    renameSaved: false,
    ...overrides,
  };
}

async function renderPanel(overrides: Partial<PanelProps> = {}) {
  const panelProps = props(overrides);
  const view = await render(
    <TestProviders>
      <AnnouncementPanel {...panelProps} />
    </TestProviders>,
  );

  return { props: panelProps, user: userEvent.setup(), view };
}

describe("AnnouncementPanel", () => {
  it("shows the current announcement and the superseded ones apart", async () => {
    await renderPanel();

    expect(screen.getByLabelText("Current title")).toHaveDisplayValue(
      current.title,
    );
    expect(screen.getByText(superseded.title)).toBeOnTheScreen();
    expect(screen.getByText("2 announcements")).toBeOnTheScreen();
  });

  it("publishes the trimmed title", async () => {
    const { props: given, user } = await renderPanel();

    // `fireEvent.changeText` would not have flushed before the press, so the
    // handler would see an empty field and the assertion would pass for the
    // wrong reason. `userEvent` awaits each step.
    await user.type(
      screen.getByLabelText("New title"),
      "  Standup moves to 10:00  ",
    );
    await user.press(screen.getByRole("button", { name: "Publish" }));

    expect(given.onPublish).toHaveBeenCalledWith("Standup moves to 10:00");
  });

  it("refuses a blank title without calling the API", async () => {
    const { props: given, user } = await renderPanel();

    await user.press(screen.getByRole("button", { name: "Publish" }));

    expect(
      screen.getByText("Enter a title for the announcement."),
    ).toBeOnTheScreen();
    expect(given.onPublish).not.toHaveBeenCalled();
  });

  /**
   * The regression a single render cannot see: the rename field seeds from a
   * prop once, so a panel that is not keyed by the announcement keeps showing
   * the previous title after a new one becomes current.
   */
  it("reseeds the rename field when another announcement becomes current", async () => {
    const { view } = await renderPanel();
    const next: Announcement = {
      id: "announcement-2",
      isCurrent: true,
      title: "Office open again",
    };

    await view.rerender(
      <TestProviders>
        <AnnouncementPanel
          {...props({
            announcements: [next, { ...current, isCurrent: false }, superseded],
          })}
        />
      </TestProviders>,
    );

    expect(screen.getByLabelText("Current title")).toHaveDisplayValue(
      next.title,
    );
  });

  it("renames the announcement it is showing", async () => {
    const { props: given, user } = await renderPanel();

    await user.clear(screen.getByLabelText("Current title"));
    await user.type(
      screen.getByLabelText("Current title"),
      "Office closed all week",
    );
    await user.press(screen.getByRole("button", { name: "Save" }));

    expect(given.onRename).toHaveBeenCalledWith({
      announcementId: current.id,
      title: "Office closed all week",
    });
  });

  it("says the group has nothing yet", async () => {
    await renderPanel({ announcements: [] });

    expect(
      screen.getByText("This group has not published an announcement yet."),
    ).toBeOnTheScreen();
  });

  it("renders in Dutch", async () => {
    await render(
      <TestProviders locale="nl">
        <AnnouncementPanel {...props()} />
      </TestProviders>,
    );

    expect(screen.getByText("Huidige aankondiging")).toBeOnTheScreen();
  });
});
