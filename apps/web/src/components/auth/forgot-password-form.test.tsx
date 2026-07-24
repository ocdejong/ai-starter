import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IntlTestProvider } from "~/test/intl";
import { ForgotPasswordForm } from "./forgot-password-form";

const mocks = vi.hoisted(() => ({ requestPasswordReset: vi.fn() }));

vi.mock("~/server/better-auth/client", () => ({
  authClient: { requestPasswordReset: mocks.requestPasswordReset },
}));

function renderForm() {
  return render(
    <IntlTestProvider>
      <ForgotPasswordForm />
    </IntlTestProvider>,
  );
}

async function submit(user: ReturnType<typeof userEvent.setup>, email: string) {
  await user.type(screen.getByLabelText("Email address"), email);
  await user.click(screen.getByRole("button", { name: "Send reset link" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requestPasswordReset.mockResolvedValue({ data: {}, error: null });
});

describe("ForgotPasswordForm", () => {
  it("reports an invalid email without reaching the auth server", async () => {
    const user = userEvent.setup();
    renderForm();

    await submit(user, "not-an-email");

    expect(
      await screen.findByText("Enter a valid email address."),
    ).toBeVisible();
    expect(mocks.requestPasswordReset).not.toHaveBeenCalled();
  });

  it("asks for a link back to the page that reads the token", async () => {
    const user = userEvent.setup();
    renderForm();

    await submit(user, "ada@example.com");

    await vi.waitFor(() => {
      expect(mocks.requestPasswordReset).toHaveBeenCalledWith({
        email: "ada@example.com",
        redirectTo: "/reset-password",
      });
    });
  });

  it("confirms without disclosing whether the account exists", async () => {
    const user = userEvent.setup();
    renderForm();

    await submit(user, "ada@example.com");

    expect(await screen.findByText("Check your email")).toBeVisible();
    expect(
      screen.getByText(
        "If an account exists for ada@example.com, a reset link is on its way.",
      ),
    ).toBeVisible();
  });

  it("reports a real failure instead of a confirmation it cannot stand behind", async () => {
    // The auth server answers 200 whether or not the address is registered, so
    // an error here is a genuine failure — not the account-does-not-exist case,
    // and claiming "check your email" would be a lie.
    mocks.requestPasswordReset.mockResolvedValue({
      data: null,
      error: { code: "INTERNAL_SERVER_ERROR", status: 500 },
    });
    const user = userEvent.setup();
    renderForm();

    await submit(user, "nobody@example.com");

    expect(
      await screen.findByText("Something went wrong. Please try again."),
    ).toBeVisible();
    expect(screen.queryByText("Check your email")).not.toBeInTheDocument();
  });
});
