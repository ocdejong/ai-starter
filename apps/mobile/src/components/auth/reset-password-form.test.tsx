import { render, screen, userEvent } from "@testing-library/react-native";

import { authClient } from "../../auth/client";
import { TestProviders } from "../../test/providers";
import { ResetPasswordForm } from "./reset-password-form";

jest.mock("../../auth/client", () => ({
  authClient: { resetPassword: jest.fn() },
}));

const resetPassword = jest.mocked(authClient.resetPassword);

async function renderForm(
  overrides: {
    linkError?: string | undefined;
    token?: string | undefined;
  } = {},
) {
  const props = {
    linkError: overrides.linkError,
    onRequestNewLink: jest.fn(),
    onSignIn: jest.fn(),
    token: "token" in overrides ? overrides.token : "reset-token",
  };
  const user = userEvent.setup();

  await render(
    <TestProviders>
      <ResetPasswordForm {...props} />
    </TestProviders>,
  );

  async function save(password: string, confirmation: string) {
    await user.type(screen.getByLabelText("New password"), password);
    await user.type(
      screen.getByLabelText("Confirm new password"),
      confirmation,
    );
    await user.press(screen.getByRole("button", { name: "Save new password" }));
  }

  return { ...props, save, user };
}

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    resetPassword.mockReset();
  });

  it("offers a new link instead of a form when the deep link carried no token", async () => {
    await renderForm({ token: undefined });

    expect(
      screen.getByText(
        "Reset links expire an hour after they are sent. Request a new one.",
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText("New password")).not.toBeOnTheScreen();
  });

  it("treats a rejected link as expired rather than showing a dead form", async () => {
    await renderForm({ linkError: "INVALID_TOKEN" });

    expect(
      screen.getByText(
        "Reset links expire an hour after they are sent. Request a new one.",
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText("New password")).not.toBeOnTheScreen();
  });

  it("refuses a confirmation that does not match", async () => {
    const { save } = await renderForm();

    await save("correct horse", "correct horses");

    expect(screen.getByText("Both passwords must match.")).toBeOnTheScreen();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("sends the new password with the token from the link", async () => {
    resetPassword.mockResolvedValue({ error: null });
    const { save } = await renderForm();

    await save("correct horse", "correct horse");

    expect(resetPassword).toHaveBeenCalledWith({
      newPassword: "correct horse",
      token: "reset-token",
    });
    expect(
      screen.getByText(
        "Signing in elsewhere has been ended. Use your new password from now on.",
      ),
    ).toBeOnTheScreen();
  });

  it("surfaces a token the server rejected on submit", async () => {
    resetPassword.mockResolvedValue({
      error: { code: "TOKEN_EXPIRED", status: 400 },
    });
    const { save } = await renderForm();

    await save("correct horse", "correct horse");

    expect(
      screen.getByText(
        "That reset link is no longer valid. Request a new one.",
      ),
    ).toBeOnTheScreen();
  });
});
