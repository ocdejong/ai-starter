import { render, screen } from "@testing-library/react-native";

import { TestProviders } from "../../test/providers";
import { AccountSection } from "./account-section";

// The summary inside signs out through the Expo auth client, which cannot load
// under jest-expo (its dependencies ship ESM `.mjs`).
jest.mock("../../auth/client", () => ({
  authClient: { signOut: jest.fn() },
}));

describe("AccountSection", () => {
  it("names the signed-in account and offers the way out", async () => {
    await render(
      <TestProviders>
        <AccountSection name="Ada Lovelace" />
      </TestProviders>,
    );

    expect(screen.getByText("Account")).toBeOnTheScreen();
    expect(screen.getByText("Signed in as Ada Lovelace")).toBeOnTheScreen();
    expect(screen.getByText("Sign out")).toBeOnTheScreen();
  });

  it("stays readable in the frame after a sign-out, when the session is gone", async () => {
    await render(
      <TestProviders>
        <AccountSection name={null} />
      </TestProviders>,
    );

    expect(
      screen.getByText("Your account settings will appear here."),
    ).toBeOnTheScreen();
    expect(screen.queryByText("Sign out")).toBeNull();
  });

  it("renders in Dutch under the Dutch catalog", async () => {
    await render(
      <TestProviders locale="nl">
        <AccountSection name="Ada Lovelace" />
      </TestProviders>,
    );

    expect(screen.getByText("Uitloggen")).toBeOnTheScreen();
  });
});
