import { render, screen, userEvent } from "@testing-library/react-native";

import { authClient } from "../../auth/client";
import { TestProviders } from "../../test/providers";
import { SessionSummary } from "./session-summary";

jest.mock("../../auth/client", () => ({
  authClient: { signOut: jest.fn() },
}));

const signOut = jest.mocked(authClient.signOut);

describe("SessionSummary", () => {
  beforeEach(() => {
    signOut.mockReset();
  });

  it("names the signed-in user", async () => {
    await render(
      <TestProviders>
        <SessionSummary name="Ada Lovelace" />
      </TestProviders>,
    );

    expect(screen.getByText("Signed in as Ada Lovelace")).toBeOnTheScreen();
  });

  it("clears the stored session on sign out", async () => {
    signOut.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    await render(
      <TestProviders>
        <SessionSummary name="Ada Lovelace" />
      </TestProviders>,
    );

    await user.press(screen.getByRole("button", { name: "Sign out" }));

    expect(signOut).toHaveBeenCalled();
  });

  it("keeps the reader informed when signing out fails", async () => {
    signOut.mockRejectedValue(new TypeError("Network request failed"));
    const user = userEvent.setup();
    await render(
      <TestProviders>
        <SessionSummary name="Ada Lovelace" />
      </TestProviders>,
    );

    await user.press(screen.getByRole("button", { name: "Sign out" }));

    expect(
      screen.getByText(
        "The server could not be reached. Check your connection and try again.",
      ),
    ).toBeOnTheScreen();
  });
});
