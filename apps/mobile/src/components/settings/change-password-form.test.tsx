import { render, screen, userEvent } from "@testing-library/react-native";

import { authClient } from "../../auth/client";
import { TestProviders } from "../../test/providers";
import { ChangePasswordForm } from "./change-password-form";

jest.mock("../../auth/client", () => ({
  authClient: { changePassword: jest.fn() },
}));

const changePassword = jest.mocked(authClient.changePassword);

async function renderForm(locale: "en" | "nl" = "en") {
  const user = userEvent.setup();

  await render(
    <TestProviders locale={locale}>
      <ChangePasswordForm />
    </TestProviders>,
  );

  async function change({
    confirmation = "a new long password",
    current = "the first correct password",
    next = "a new long password",
  }: {
    confirmation?: string;
    current?: string;
    next?: string;
  } = {}) {
    await user.type(screen.getByLabelText("Current password"), current);
    await user.type(screen.getByLabelText("New password"), next);
    await user.type(
      screen.getByLabelText("Confirm new password"),
      confirmation,
    );
    await user.press(screen.getByRole("button", { name: "Change password" }));
  }

  return { change, user };
}

describe("ChangePasswordForm", () => {
  beforeEach(() => {
    changePassword.mockReset();
    changePassword.mockResolvedValue({ data: {}, error: null });
  });

  it("leaves the other devices alone unless the change explicitly asks", async () => {
    const { change } = await renderForm();

    await change();

    expect(changePassword).toHaveBeenCalledWith({
      currentPassword: "the first correct password",
      newPassword: "a new long password",
      revokeOtherSessions: false,
    });
    expect(
      await screen.findByText("Your password has been changed."),
    ).toBeVisible();
  });

  it("passes the choice to sign out the other devices when it is made", async () => {
    const { change, user } = await renderForm();

    await user.press(screen.getByLabelText("Sign out my other devices"));
    await change();

    expect(changePassword).toHaveBeenCalledWith(
      expect.objectContaining({ revokeOtherSessions: true }),
    );
  });

  it("refuses a mismatched confirmation without reaching the auth server", async () => {
    const { change } = await renderForm();

    await change({ confirmation: "something else entirely" });

    expect(await screen.findByText("Both passwords must match.")).toBeVisible();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("says which password was wrong when the auth server refuses the current one", async () => {
    changePassword.mockResolvedValue({
      error: { code: "INVALID_PASSWORD" },
    });
    const { change } = await renderForm();

    await change();

    expect(
      await screen.findByText("That is not your current password."),
    ).toBeVisible();
  });

  it("clears the typed secrets once the change succeeds", async () => {
    const { change } = await renderForm();

    await change();

    expect(
      await screen.findByText("Your password has been changed."),
    ).toBeVisible();
    expect(screen.getByLabelText("Current password")).toHaveDisplayValue("");
    expect(screen.getByLabelText("New password")).toHaveDisplayValue("");
  });

  it("renders in Dutch when the locale is Dutch", async () => {
    await renderForm("nl");

    expect(
      screen.getByRole("button", { name: "Wachtwoord wijzigen" }),
    ).toBeVisible();
  });
});
