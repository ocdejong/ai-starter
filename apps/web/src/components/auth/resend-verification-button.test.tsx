import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IntlTestProvider } from "~/test/intl";
import { ResendVerificationButton } from "./resend-verification-button";

const mocks = vi.hoisted(() => ({ sendVerificationEmail: vi.fn() }));

vi.mock("~/server/better-auth/client", () => ({
  authClient: { sendVerificationEmail: mocks.sendVerificationEmail },
}));

function renderButton() {
  return render(
    <IntlTestProvider>
      <ResendVerificationButton email="ada@example.com" />
    </IntlTestProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ResendVerificationButton", () => {
  it("confirms once a new link has been sent", async () => {
    mocks.sendVerificationEmail.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole("button", { name: "Send a new link" }));

    expect(mocks.sendVerificationEmail).toHaveBeenCalledWith({
      callbackURL: "/verify-email",
      email: "ada@example.com",
    });
    expect(
      await screen.findByText("Sent. Check your inbox for the new link."),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Send a new link" }),
    ).not.toBeInTheDocument();
  });

  it("says so when the link could not be sent, and lets the visitor retry", async () => {
    mocks.sendVerificationEmail.mockResolvedValue({
      data: null,
      error: { code: "INTERNAL_SERVER_ERROR", status: 500 },
    });
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole("button", { name: "Send a new link" }));

    expect(
      await screen.findByText(
        "We could not send a new link. Please try again.",
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Send a new link" }),
    ).toBeEnabled();
  });
});
