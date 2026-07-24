import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IntlTestProvider } from "~/test/intl";
import { ResetPasswordForm } from "./reset-password-form";

const mocks = vi.hoisted(() => ({ resetPassword: vi.fn() }));

vi.mock("~/server/better-auth/client", () => ({
  authClient: { resetPassword: mocks.resetPassword },
}));

function renderForm() {
  return render(
    <IntlTestProvider>
      <ResetPasswordForm token="a-reset-token" />
    </IntlTestProvider>,
  );
}

async function submit(
  user: ReturnType<typeof userEvent.setup>,
  { confirmation, password }: { confirmation: string; password: string },
) {
  await user.type(screen.getByLabelText("New password"), password);
  await user.type(screen.getByLabelText("Confirm new password"), confirmation);
  await user.click(screen.getByRole("button", { name: "Save new password" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resetPassword.mockResolvedValue({ data: {}, error: null });
});

describe("ResetPasswordForm", () => {
  it("reports a mismatch on the field the user retypes", async () => {
    const user = userEvent.setup();
    renderForm();

    await submit(user, {
      confirmation: "a different password",
      password: "a long enough password",
    });

    expect(await screen.findByText("Both passwords must match.")).toBeVisible();
    expect(mocks.resetPassword).not.toHaveBeenCalled();
  });

  it("applies the password policy to the new password", async () => {
    const user = userEvent.setup();
    renderForm();

    await submit(user, { confirmation: "short", password: "short" });

    expect(await screen.findByText("Use at least 8 characters.")).toBeVisible();
    expect(mocks.resetPassword).not.toHaveBeenCalled();
  });

  it("sends the token from the link with the new password", async () => {
    const user = userEvent.setup();
    renderForm();

    await submit(user, {
      confirmation: "a long enough password",
      password: "a long enough password",
    });

    await vi.waitFor(() => {
      expect(mocks.resetPassword).toHaveBeenCalledWith({
        newPassword: "a long enough password",
        token: "a-reset-token",
      });
    });
    expect(await screen.findByText("Password updated")).toBeVisible();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
  });

  it("explains a rejected token instead of leaving the visitor stuck", async () => {
    mocks.resetPassword.mockResolvedValue({
      data: null,
      error: { code: "INVALID_TOKEN", status: 400 },
    });
    const user = userEvent.setup();
    renderForm();

    await submit(user, {
      confirmation: "a long enough password",
      password: "a long enough password",
    });

    expect(
      await screen.findByText(
        "That reset link is no longer valid. Request a new one.",
      ),
    ).toBeVisible();
    expect(screen.queryByText("Password updated")).not.toBeInTheDocument();
  });
});
