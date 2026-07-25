import { render, screen } from "@testing-library/react-native";

import { TestProviders } from "../../test/providers";
import { AccountSection } from "./account-section";

// Every screen below reaches the Expo auth client, which cannot load under
// jest-expo (its dependencies ship ESM `.mjs`).
jest.mock("../../auth/client", () => ({
  authClient: {
    changeEmail: jest.fn(),
    changePassword: jest.fn(),
    deleteUser: jest.fn(),
    listSessions: jest.fn().mockResolvedValue({ data: [], error: null }),
    revokeOtherSessions: jest.fn(),
    revokeSession: jest.fn(),
    signOut: jest.fn(),
    updateUser: jest.fn(),
  },
}));

const identity = {
  email: "ada@example.com",
  name: "Ada Lovelace",
  sessionToken: "token-current",
};

describe("AccountSection", () => {
  it("names the signed-in account and offers the way out", async () => {
    await render(
      <TestProviders>
        <AccountSection identity={identity} />
      </TestProviders>,
    );

    expect(screen.getByText("Account")).toBeOnTheScreen();
    expect(screen.getByText("Signed in as Ada Lovelace")).toBeOnTheScreen();
    expect(screen.getByText("Sign out")).toBeOnTheScreen();
  });

  it("carries every account screen the settings tab owes", async () => {
    await render(
      <TestProviders>
        <AccountSection identity={identity} />
      </TestProviders>,
    );

    expect(screen.getByText("Profile")).toBeOnTheScreen();
    expect(screen.getByText("Email address")).toBeOnTheScreen();
    expect(screen.getByText("Password")).toBeOnTheScreen();
    expect(screen.getByText("Active sessions")).toBeOnTheScreen();
    expect(
      screen.getByRole("button", { name: "Delete account" }),
    ).toBeOnTheScreen();
  });

  it("stays readable in the frame after a sign-out, when the session is gone", async () => {
    await render(
      <TestProviders>
        <AccountSection identity={null} />
      </TestProviders>,
    );

    expect(
      screen.getByText("Your account settings will appear here."),
    ).toBeOnTheScreen();
    expect(screen.queryByText("Sign out")).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete account" })).toBeNull();
  });

  it("renders in Dutch under the Dutch catalog", async () => {
    await render(
      <TestProviders locale="nl">
        <AccountSection identity={identity} />
      </TestProviders>,
    );

    expect(screen.getByText("Uitloggen")).toBeOnTheScreen();
    expect(screen.getByText("Wachtwoord")).toBeOnTheScreen();
  });
});
