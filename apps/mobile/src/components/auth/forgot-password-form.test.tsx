import { render, screen, userEvent } from "@testing-library/react-native";

import { authClient } from "../../auth/client";
import { TestProviders } from "../../test/providers";
import { ForgotPasswordForm } from "./forgot-password-form";

jest.mock("../../auth/client", () => ({
  authClient: { requestPasswordReset: jest.fn() },
}));

jest.mock("expo-linking", () => ({
  createURL: (path: string) => `ai-starter://${path}`,
}));

const requestPasswordReset = jest.mocked(authClient.requestPasswordReset);

async function renderForm() {
  const props = { onSignIn: jest.fn() };
  const user = userEvent.setup();

  await render(
    <TestProviders>
      <ForgotPasswordForm {...props} />
    </TestProviders>,
  );

  async function request(email: string) {
    await user.type(screen.getByLabelText("Email address"), email);
    await user.press(screen.getByRole("button", { name: "Send reset link" }));
  }

  return { ...props, request };
}

describe("ForgotPasswordForm", () => {
  beforeEach(() => {
    requestPasswordReset.mockReset();
  });

  it("refuses an address that cannot receive a link", async () => {
    const { request } = await renderForm();

    await request("nope");

    expect(screen.getByText("Enter a valid email address.")).toBeOnTheScreen();
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it("sends the reset link back to this app", async () => {
    requestPasswordReset.mockResolvedValue({ error: null });
    const { request } = await renderForm();

    await request("person@example.com");

    expect(requestPasswordReset).toHaveBeenCalledWith({
      email: "person@example.com",
      redirectTo: "ai-starter:///reset-password",
    });
  });

  it("confirms without revealing whether the address has an account", async () => {
    requestPasswordReset.mockResolvedValue({ error: null });
    const { request } = await renderForm();

    await request("person@example.com");

    expect(
      screen.getByText(
        "If an account exists for person@example.com, a reset link is on its way. Open the link on this device to continue in the app.",
      ),
    ).toBeOnTheScreen();
    expect(
      screen.queryByRole("button", { name: "Send reset link" }),
    ).not.toBeOnTheScreen();
  });

  it("reports an unreachable server", async () => {
    requestPasswordReset.mockRejectedValue(
      new TypeError("Network request failed"),
    );
    const { request } = await renderForm();

    await request("person@example.com");

    expect(
      screen.getByText(
        "The server could not be reached. Check your connection and try again.",
      ),
    ).toBeOnTheScreen();
  });
});
