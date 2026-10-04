import { messages } from "@ai-starter/i18n";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AnnouncementBoard,
  announcementFailure,
  announcementReadFailure,
} from "~/components/announcements/announcement-board";
import {
  AnnouncementPanel,
  type Announcement,
} from "~/components/announcements/announcement-panel";
import { IntlTestProvider } from "~/test/intl";

const mocks = vi.hoisted(() => {
  const announcementQuery: {
    data: readonly { id: string; isCurrent: boolean; title: string }[];
    error: { data: unknown } | null;
    isError: boolean;
    isPending: boolean;
  } = { data: [], error: null, isError: false, isPending: false };

  return { announcementQuery, invalidate: vi.fn() };
});

// The board is wired to the API through these hooks; replacing them lets a test
// put the query in exactly the state under examination.
vi.mock("~/trpc/react", () => {
  const idleMutation = {
    useMutation: () => ({
      error: null,
      isPending: false,
      isSuccess: false,
      mutate: vi.fn(),
    }),
  };

  return {
    api: {
      announcement: {
        create: idleMutation,
        list: { useQuery: () => mocks.announcementQuery },
        rename: idleMutation,
      },
      useUtils: () => ({
        announcement: { list: { invalidate: mocks.invalidate } },
      }),
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.announcementQuery = {
    data: [],
    error: null,
    isError: false,
    isPending: false,
  };
});

const current: Announcement = {
  id: "announcement-1",
  isCurrent: true,
  title: "The first announcement",
};
const superseded: Announcement = {
  id: "announcement-0",
  isCurrent: false,
  title: "An earlier announcement",
};

function renderPanel(
  overrides: Partial<Parameters<typeof AnnouncementPanel>[0]> = {},
) {
  const props = {
    announcements: [current, superseded],
    failure: null,
    isCreating: false,
    isRenaming: false,
    onCreate: vi.fn(),
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
      "  A second announcement  ",
    );
    await user.click(screen.getByRole("button", { name: "Publish" }));

    expect(props.onCreate).toHaveBeenCalledWith("A second announcement");
  });

  it("refuses a blank title without calling the API", async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();

    await user.click(screen.getByRole("button", { name: "Publish" }));

    expect(await screen.findByText("Enter a title.")).toBeInTheDocument();
    expect(props.onCreate).not.toHaveBeenCalled();
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
      title: "A second announcement",
    };

    view.rerender(
      <IntlTestProvider>
        <AnnouncementPanel
          announcements={[next, { ...current, isCurrent: false }, superseded]}
          failure={null}
          isCreating={false}
          isRenaming={false}
          onCreate={vi.fn()}
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
    await user.type(field, "The renamed announcement");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(props.onRename).toHaveBeenCalledWith({
      announcementId: current.id,
      title: "The renamed announcement",
    });
  });

  it("says the group has nothing yet", () => {
    renderPanel({ announcements: [] });

    expect(
      screen.getByText("This group has not published anything yet."),
    ).toBeInTheDocument();
    expect(screen.getByText("No announcements yet")).toBeInTheDocument();
  });

  it("reports a refused write", () => {
    renderPanel({ failure: "unexpected" });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
  });

  // Asserted through the catalog rather than a literal, because a generated
  // feature's Dutch entries start out as the English ones: this proves the
  // component resolves through the Dutch messages, and keeps proving it after
  // someone translates them.
  it("renders in Dutch", () => {
    render(
      <IntlTestProvider locale="nl">
        <AnnouncementPanel
          announcements={[current]}
          failure={null}
          isCreating={false}
          isRenaming={false}
          onCreate={vi.fn()}
          onRename={vi.fn()}
          renameSaved={false}
        />
      </IntlTestProvider>,
    );

    expect(
      screen.getByRole("heading", {
        name: messages.nl.app.announcements.current.title,
      }),
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

describe("announcementReadFailure", () => {
  it("separates a missing group and an ended session from a failure to retry", () => {
    expect(announcementReadFailure(null)).toBeNull();
    expect(announcementReadFailure({ data: null })).toBe("network");
    expect(
      announcementReadFailure({ data: { code: "PRECONDITION_FAILED" } }),
    ).toBe("noGroup");
    expect(announcementReadFailure({ data: { code: "UNAUTHORIZED" } })).toBe(
      "signIn",
    );
    expect(
      announcementReadFailure({ data: { code: "INTERNAL_SERVER_ERROR" } }),
    ).toBe("unexpected");
  });
});

describe("AnnouncementBoard", () => {
  function renderBoard(locale: "en" | "nl" = "en") {
    return render(
      <IntlTestProvider locale={locale}>
        <AnnouncementBoard />
      </IntlTestProvider>,
    );
  }

  it("offers a way to a group when the active group is gone", () => {
    mocks.announcementQuery = {
      data: [],
      error: { data: { code: "PRECONDITION_FAILED" } },
      isError: true,
      isPending: false,
    };
    renderBoard();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose or create a group before reading announcements.",
    );
    expect(
      screen.getByRole("link", { name: "Create a group" }),
    ).toHaveAttribute("href", "/settings/group");
  });

  it("asks for a new sign-in when the session has ended", () => {
    mocks.announcementQuery = {
      data: [],
      error: { data: { code: "UNAUTHORIZED" } },
      isError: true,
      isPending: false,
    };
    renderBoard();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Sign in again to read announcements.",
    );
  });

  // A refetch that fails leaves the last good data on the query. Showing it
  // would present the previous group's announcements as the current group's,
  // so the failure has to win over the cache.
  it("shows the failure rather than cached data when a refetch fails", () => {
    mocks.announcementQuery = {
      data: [current],
      error: { data: { code: "PRECONDITION_FAILED" } },
      isError: true,
      isPending: false,
    };
    renderBoard();

    expect(screen.queryByText(current.title)).toBeNull();
    expect(
      screen.getByRole("link", { name: "Create a group" }),
    ).toBeInTheDocument();
  });

  it("shows the announcements when the query is healthy", () => {
    mocks.announcementQuery = {
      data: [current],
      error: null,
      isError: false,
      isPending: false,
    };
    renderBoard();

    expect(screen.getByRole("textbox", { name: "Current title" })).toHaveValue(
      current.title,
    );
  });

  it("renders the recovery copy in Dutch", () => {
    mocks.announcementQuery = {
      data: [],
      error: { data: { code: "PRECONDITION_FAILED" } },
      isError: true,
      isPending: false,
    };
    renderBoard("nl");

    expect(screen.getByRole("alert")).toHaveTextContent(
      messages.nl.app.announcements.noGroup,
    );
    expect(
      screen.getByRole("link", {
        name: messages.nl.app.announcements.createGroup,
      }),
    ).toBeInTheDocument();
  });
});
