import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { announcementFailure } from "~/components/announcements/announcement-board";
import {
  AnnouncementPanel,
  type Announcement,
} from "~/components/announcements/announcement-panel";
import { IntlTestProvider } from "~/test/intl";

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

function renderPanel(
  overrides: Partial<Parameters<typeof AnnouncementPanel>[0]> = {},
) {
  const props = {
    announcements: [current, superseded],
    failure: null,
    isPublishing: false,
    isRenaming: false,
    onPublish: vi.fn(),
    onRename: vi.fn(),
    renameSaved: false,
    ...overrides,
  } satisfies Parameters<typeof AnnouncementPanel>[0];

  const view = render(
    <IntlTestProvider>
      <AnnouncementPanel {...props} />
    </IntlTestProvider>,
  );

  return { props, view };
}

describe("AnnouncementPanel", () => {
  it("shows the current announcement and the superseded ones apart", () => {
    renderPanel();

    expect(screen.getByRole("textbox", { name: "Current title" })).toHaveValue(
      current.title,
    );
    expect(
      within(
        screen.getByRole("region", { name: "Earlier announcements" }),
      ).getByText(superseded.title),
    ).toBeInTheDocument();
    expect(screen.getByText("2 announcements")).toBeInTheDocument();
  });

  it("publishes the trimmed title", async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();

    await user.type(
      screen.getByRole("textbox", { name: "New title" }),
      "  Standup moves to 10:00  ",
    );
    await user.click(screen.getByRole("button", { name: "Publish" }));

    expect(props.onPublish).toHaveBeenCalledWith("Standup moves to 10:00");
  });

  it("refuses a blank title without calling the API", async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();

    await user.click(screen.getByRole("button", { name: "Publish" }));

    expect(
      await screen.findByText("Enter a title for the announcement."),
    ).toBeInTheDocument();
    expect(props.onPublish).not.toHaveBeenCalled();
  });

  /**
   * The regression a single render cannot see: the rename form reads its
   * default value once, so a panel that is not keyed by the announcement keeps
   * showing the previous title after a new one becomes current.
   */
  it("reseeds the rename field when another announcement becomes current", () => {
    const { view } = renderPanel();
    const next: Announcement = {
      id: "announcement-2",
      isCurrent: true,
      title: "Office open again",
    };

    view.rerender(
      <IntlTestProvider>
        <AnnouncementPanel
          announcements={[next, { ...current, isCurrent: false }, superseded]}
          failure={null}
          isPublishing={false}
          isRenaming={false}
          onPublish={vi.fn()}
          onRename={vi.fn()}
          renameSaved={false}
        />
      </IntlTestProvider>,
    );

    expect(screen.getByRole("textbox", { name: "Current title" })).toHaveValue(
      next.title,
    );
  });

  it("renames the announcement it is showing", async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();
    const field = screen.getByRole("textbox", { name: "Current title" });

    await user.clear(field);
    await user.type(field, "Office closed all week");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(props.onRename).toHaveBeenCalledWith({
      announcementId: current.id,
      title: "Office closed all week",
    });
  });

  it("says the group has nothing yet", () => {
    renderPanel({ announcements: [] });

    expect(
      screen.getByText("This group has not published an announcement yet."),
    ).toBeInTheDocument();
    expect(screen.getByText("No announcements yet")).toBeInTheDocument();
  });

  it("reports a refused write", () => {
    renderPanel({ failure: "unexpected" });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
  });

  it("renders in Dutch", () => {
    render(
      <IntlTestProvider locale="nl">
        <AnnouncementPanel
          announcements={[current]}
          failure={null}
          isPublishing={false}
          isRenaming={false}
          onPublish={vi.fn()}
          onRename={vi.fn()}
          renameSaved={false}
        />
      </IntlTestProvider>,
    );

    expect(
      screen.getByRole("heading", { name: "Huidige aankondiging" }),
    ).toBeInTheDocument();
  });
});

describe("announcementFailure", () => {
  it("tells a request that never arrived from one that was refused", () => {
    expect(announcementFailure(null)).toBeNull();
    expect(announcementFailure({ data: null })).toBe("network");
    expect(announcementFailure({ data: { code: "FORBIDDEN" } })).toBe(
      "unexpected",
    );
  });
});
