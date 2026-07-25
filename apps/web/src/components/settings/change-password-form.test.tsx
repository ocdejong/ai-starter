import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IntlTestProvider } from "~/test/intl";
import { ChangePasswordForm } from "./change-password-form";

const mocks = vi.hoisted(() => ({
  changePassword: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("~/server/better-auth/client", () => ({
  authClient: { changePassword: mocks.changePassword },
}));

function renderForm(locale: "en" | "nl" = "en") {
  return render(
    <IntlTestProvider locale={locale}>
      <ChangePasswordForm />
    </IntlTestProvider>,
  );
}

async function fill(
  user: ReturnType<typeof userEvent.setup>,
  {
    confirmPassword = "a new long password",
    current = "the first correct password",
    next = "a new long password",
  }: { confirmPassword?: string; current?: string; next?: string } = {},
) {
  await user.type(screen.getByLabelText("Current password"), current);
  await user.type(screen.getByLabelText("New password"), next);
  await user.type(
    screen.getByLabelText("Confirm new password"),
    confirmPassword,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.changePassword.mockResolvedValue({ data: {}, error: null });
});

describe("ChangePasswordForm", () => {
  it("leaves the other devices alone unless the change explicitly asks", async () => {
    const user = userEvent.setup();
    renderForm();

    await fill(user);
    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(mocks.changePassword).toHaveBeenCalledWith({
      currentPassword: "the first correct password",
      newPassword: "a new long password",
      revokeOtherSessions: false,
    });
    expect(
      await screen.findByText("Your password has been changed."),
    ).toBeVisible();
  });

  it("passes the choice to sign out the other devices when it is made", async () => {
    const user = userEvent.setup();
    renderForm();

    await fill(user);
    await user.click(screen.getByLabelText("Sign out my other devices"));
    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(mocks.changePassword).toHaveBeenCalledWith(
      expect.objectContaining({ revokeOtherSessions: true }),
    );
    // The session list on the page behind this form is now stale.
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("refuses a mismatched confirmation without reaching the auth server", async () => {
    const user = userEvent.setup();
    renderForm();

    await fill(user, { confirmPassword: "something else entirely" });
    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByText("Both passwords must match.")).toBeVisible();
    expect(mocks.changePassword).not.toHaveBeenCalled();
  });

  it("refuses a new password below the policy without reaching the auth server", async () => {
    const user = userEvent.setup();
    renderForm();

    await fill(user, { confirmPassword: "short", next: "short" });
    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByText("Use at least 8 characters.")).toBeVisible();
    expect(mocks.changePassword).not.toHaveBeenCalled();
  });

  it("says which password was wrong when the auth server refuses the current one", async () => {
    mocks.changePassword.mockResolvedValue({
      error: { code: "INVALID_PASSWORD" },
    });
    const user = userEvent.setup();
    renderForm();

    await fill(user);
    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(
      await screen.findByText("That is not your current password."),
    ).toBeVisible();
    expect(screen.queryByText("Your password has been changed.")).toBeNull();
  });

  it("clears the typed secrets once the change succeeds", async () => {
    const user = userEvent.setup();
    renderForm();

    await fill(user);
    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(
      await screen.findByText("Your password has been changed."),
    ).toBeVisible();
    expect(screen.getByLabelText("Current password")).toHaveValue("");
    expect(screen.getByLabelText("New password")).toHaveValue("");
  });

  it("renders in Dutch when the locale is Dutch", () => {
    renderForm("nl");

    expect(
      screen.getByRole("button", { name: "Wachtwoord wijzigen" }),
    ).toBeVisible();
  });
});
