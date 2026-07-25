import {
  render,
  screen,
  userEvent,
  within,
} from "@testing-library/react-native";

import { authClient } from "../../auth/client";
import { TestProviders } from "../../test/providers";
import { SessionsList } from "./sessions-list";

jest.mock("../../auth/client", () => ({
  authClient: {
    listSessions: jest.fn(),
    revokeOtherSessions: jest.fn(),
    revokeSession: jest.fn(),
  },
}));

const listSessions = jest.mocked(authClient.listSessions);
const revokeSession = jest.mocked(authClient.revokeSession);
const revokeOtherSessions = jest.mocked(authClient.revokeOtherSessions);

const currentToken = "token-current";

function session(overrides: {
  token: string;
  updatedAt?: string;
  userAgent?: string | null;
}) {
  return {
    id: `id-${overrides.token}`,
    token: overrides.token,
    updatedAt: overrides.updatedAt ?? "2026-07-24T10:00:00.000Z",
    userAgent:
      overrides.userAgent === undefined
        ? "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"
        : overrides.userAgent,
  };
}

async function renderList(locale: "en" | "nl" = "en") {
  const user = userEvent.setup();

  await render(
    <TestProviders locale={locale}>
      <SessionsList currentToken={currentToken} />
    </TestProviders>,
  );

  return { user };
}

describe("SessionsList", () => {
  beforeEach(() => {
    listSessions.mockReset();
    revokeSession.mockReset();
    revokeOtherSessions.mockReset();
    revokeSession.mockResolvedValue({ data: { status: true } } as never);
    revokeOtherSessions.mockResolvedValue({ data: { status: true } } as never);
    listSessions.mockResolvedValue({
      data: [
        session({ token: currentToken }),
        session({
          token: "token-other",
          userAgent: "okhttp/4.12.0 (Android 15)",
        }),
      ],
      error: null,
    } as never);
  });

  it("names the device behind each session and marks the one being used", async () => {
    await renderList();

    expect(await screen.findByText("Chrome on macOS")).toBeVisible();
    expect(screen.getByText("Unknown browser on Android")).toBeVisible();
    expect(screen.getByText("This device")).toBeVisible();
  });

  it("offers no way to sign out of the session doing the asking", async () => {
    listSessions.mockResolvedValue({
      data: [session({ token: currentToken })],
      error: null,
    } as never);
    await renderList();

    expect(
      await screen.findByText(
        "This is the only device signed in to your account.",
      ),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
  });

  it("revokes the session belonging to the row that was pressed", async () => {
    const { user } = await renderList();

    const row = await screen.findByLabelText("Unknown browser on Android");
    await user.press(within(row).getByRole("button", { name: "Sign out" }));

    expect(revokeSession).toHaveBeenCalledWith({ token: "token-other" });
  });

  it("signs out every other device at once and re-reads the list", async () => {
    const { user } = await renderList();

    await user.press(
      await screen.findByRole("button", { name: "Sign out all other devices" }),
    );

    expect(revokeOtherSessions).toHaveBeenCalledTimes(1);
    // Two reads: the first render, and the one that proves the list shrank.
    expect(listSessions).toHaveBeenCalledTimes(2);
  });

  it("reports a list it could not read instead of showing an empty one", async () => {
    listSessions.mockResolvedValue({
      data: null,
      error: { code: "UNKNOWN" },
    } as never);
    await renderList();

    expect(
      await screen.findByText("Something went wrong. Please try again."),
    ).toBeVisible();
  });

  it("renders in Dutch when the locale is Dutch", async () => {
    await renderList("nl");

    expect(await screen.findByText("Dit apparaat")).toBeVisible();
  });
});
