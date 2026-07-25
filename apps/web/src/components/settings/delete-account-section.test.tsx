import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IntlTestProvider } from "~/test/intl";
import { DeleteAccountSection } from "./delete-account-section";

const mocks = vi.hoisted(() => ({ deleteUser: vi.fn() }));

vi.mock("~/server/better-auth/client", () => ({
  authClient: { deleteUser: mocks.deleteUser },
}));

function renderSection(locale: "en" | "nl" = "en") {
  return render(
    <IntlTestProvider locale={locale}>
      <DeleteAccountSection email="ada@example.com" />
    </IntlTestProvider>,
  );
}

async function openConfirmation(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Delete account" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.deleteUser.mockResolvedValue({
    data: { message: "Verification email sent", success: true },
    error: null,
  });
});

describe("DeleteAccountSection", () => {
  it("asks nothing of the auth server until the deletion is confirmed", async () => {
    const user = userEvent.setup();
    renderSection();

    await openConfirmation(user);

    expect(mocks.deleteUser).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Permanently delete account" }),
    ).toBeDisabled();
  });

  it("only enables the deletion once the account's own address is typed", async () => {
    const user = userEvent.setup();
    renderSection();
    await openConfirmation(user);

    await user.type(screen.getByLabelText("Your email address"), "ada@example");
    expect(
      screen.getByRole("button", { name: "Permanently delete account" }),
    ).toBeDisabled();

    await user.type(screen.getByLabelText("Your email address"), ".com");
    expect(
      screen.getByRole("button", { name: "Permanently delete account" }),
    ).toBeEnabled();
  });

  it("requests the deletion and says plainly that nothing is gone yet", async () => {
    const user = userEvent.setup();
    renderSection();
    await openConfirmation(user);

    await user.type(
      screen.getByLabelText("Your email address"),
      "ada@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: "Permanently delete account" }),
    );

    expect(mocks.deleteUser).toHaveBeenCalledWith({ callbackURL: "/" });
    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent("ada@example.com");
    expect(notice).toHaveTextContent("Nothing has been deleted yet.");
  });

  it("lets the reader back out without deleting anything", async () => {
    const user = userEvent.setup();
    renderSection();
    await openConfirmation(user);

    await user.click(screen.getByRole("button", { name: "Keep my account" }));

    expect(screen.queryByLabelText("Your email address")).toBeNull();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("reports a refused request instead of claiming an email was sent", async () => {
    mocks.deleteUser.mockResolvedValue({ error: { code: "UNKNOWN" } });
    const user = userEvent.setup();
    renderSection();
    await openConfirmation(user);

    await user.type(
      screen.getByLabelText("Your email address"),
      "ada@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: "Permanently delete account" }),
    );

    expect(
      await screen.findByText("Something went wrong. Please try again."),
    ).toBeVisible();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("renders in Dutch when the locale is Dutch", () => {
    renderSection("nl");

    expect(
      screen.getByRole("button", { name: "Account verwijderen" }),
    ).toBeVisible();
  });
});
