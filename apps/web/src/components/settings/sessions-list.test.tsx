import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IntlTestProvider } from "~/test/intl";
import { SessionsList, type SessionView } from "./sessions-list";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  revokeOthers: vi.fn(),
  revokeSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

const current: SessionView = {
  browser: "chrome",
  id: "session-current",
  isCurrent: true,
  lastActive: "24 July 2026 at 10:00",
  platform: "macos",
};

const other: SessionView = {
  browser: "unknown",
  id: "session-other",
  isCurrent: false,
  lastActive: "23 July 2026 at 09:00",
  platform: "android",
};

const unrecognised: SessionView = {
  browser: "unknown",
  id: "session-unknown",
  isCurrent: false,
  lastActive: "22 July 2026 at 08:00",
  platform: "unknown",
};

function renderList(
  sessions: readonly SessionView[],
  locale: "en" | "nl" = "en",
) {
  return render(
    <IntlTestProvider locale={locale}>
      <SessionsList
        revokeOtherSessions={mocks.revokeOthers}
        revokeSession={mocks.revokeSession}
        sessions={sessions}
      />
    </IntlTestProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.revokeSession.mockResolvedValue(undefined);
  mocks.revokeOthers.mockResolvedValue(undefined);
});

describe("SessionsList", () => {
  it("names the device behind each session and marks the one being used", () => {
    renderList([current, other]);

    expect(screen.getByText("Chrome on macOS")).toBeVisible();
    expect(screen.getByText("Unknown browser on Android")).toBeVisible();
    expect(screen.getByText("This device")).toBeVisible();
  });

  it("admits when it cannot recognise the device at all", () => {
    renderList([current, unrecognised]);

    expect(screen.getByText("Unrecognised device")).toBeVisible();
  });

  it("offers no way to sign out of the session doing the asking", () => {
    renderList([current]);

    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
    expect(
      screen.getByText("This is the only device signed in to your account."),
    ).toBeVisible();
  });

  it("revokes the session belonging to the row that was pressed", async () => {
    const user = userEvent.setup();
    renderList([current, other]);

    const row = screen.getByRole("listitem", {
      name: "Unknown browser on Android",
    });
    await user.click(within(row).getByRole("button", { name: "Sign out" }));

    expect(mocks.revokeSession).toHaveBeenCalledWith("session-other");
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("signs out every other device at once", async () => {
    const user = userEvent.setup();
    renderList([current, other, unrecognised]);

    await user.click(
      screen.getByRole("button", { name: "Sign out all other devices" }),
    );

    expect(mocks.revokeOthers).toHaveBeenCalledTimes(1);
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("reports a refused revocation instead of silently leaving the row", async () => {
    mocks.revokeSession.mockRejectedValue(new Error("nope"));
    const user = userEvent.setup();
    renderList([current, other]);

    const row = screen.getByRole("listitem", {
      name: "Unknown browser on Android",
    });
    await user.click(within(row).getByRole("button", { name: "Sign out" }));

    expect(
      await screen.findByText("Something went wrong. Please try again."),
    ).toBeVisible();
  });

  it("renders in Dutch when the locale is Dutch", () => {
    renderList([current, other], "nl");

    expect(screen.getByText("Dit apparaat")).toBeVisible();
    expect(screen.getByText("Onbekende browser op Android")).toBeVisible();
  });
});
