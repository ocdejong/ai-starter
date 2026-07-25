import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IntlTestProvider } from "~/test/intl";
import { ChangeEmailForm } from "./change-email-form";

const mocks = vi.hoisted(() => ({ changeEmail: vi.fn() }));

vi.mock("~/server/better-auth/client", () => ({
  authClient: { changeEmail: mocks.changeEmail },
}));

function renderForm(locale: "en" | "nl" = "en") {
  return render(
    <IntlTestProvider locale={locale}>
      <ChangeEmailForm email="ada@example.com" />
    </IntlTestProvider>,
  );
}

async function request(
  user: ReturnType<typeof userEvent.setup>,
  address: string,
) {
  await user.type(screen.getByLabelText("New email address"), address);
  await user.click(
    screen.getByRole("button", { name: "Send confirmation link" }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.changeEmail.mockResolvedValue({ data: {}, error: null });
});

describe("ChangeEmailForm", () => {
  it("shows the address the account currently uses", () => {
    renderForm();

    expect(screen.getByText("ada@example.com")).toBeVisible();
  });

  it("explains up front that the change takes two links", () => {
    renderForm();

    expect(
      screen.getByText(
        "Changing your address takes two links: one from your current inbox to approve the change, then one from the new inbox to complete it.",
      ),
    ).toBeVisible();
  });

  it("asks the auth server to confirm from the current inbox and comes back here", async () => {
    const user = userEvent.setup();
    renderForm();

    await request(user, "grace@example.com");

    expect(mocks.changeEmail).toHaveBeenCalledWith({
      callbackURL: "/settings/account?emailChange=confirmed",
      newEmail: "grace@example.com",
    });
  });

  it("names both inboxes in the order the user must open them", async () => {
    const user = userEvent.setup();
    renderForm();

    await request(user, "grace@example.com");

    const confirmation = await screen.findByRole("status");
    expect(confirmation).toHaveTextContent("ada@example.com");
    expect(confirmation).toHaveTextContent("grace@example.com");
  });

  it("refuses an address that is not an email without reaching the auth server", async () => {
    const user = userEvent.setup();
    renderForm();

    await request(user, "grace");

    expect(
      await screen.findByText("Enter a valid email address."),
    ).toBeVisible();
    expect(mocks.changeEmail).not.toHaveBeenCalled();
  });

  it("refuses the address the account already uses without reaching the auth server", async () => {
    const user = userEvent.setup();
    renderForm();

    await request(user, "Ada@Example.com");

    expect(
      await screen.findByText("That is already your email address."),
    ).toBeVisible();
    expect(mocks.changeEmail).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("reports a refused request instead of claiming a link was sent", async () => {
    mocks.changeEmail.mockResolvedValue({ error: { code: "UNKNOWN" } });
    const user = userEvent.setup();
    renderForm();

    await request(user, "grace@example.com");

    expect(
      await screen.findByText("Something went wrong. Please try again."),
    ).toBeVisible();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("renders in Dutch when the locale is Dutch", () => {
    renderForm("nl");

    expect(
      screen.getByRole("button", { name: "Bevestigingslink versturen" }),
    ).toBeVisible();
  });
});
