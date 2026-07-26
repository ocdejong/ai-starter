import { render, screen, userEvent } from "@testing-library/react-native";

import { authClient } from "../../auth/client";
import { TestProviders } from "../../test/providers";
import { ChangeEmailForm } from "./change-email-form";

jest.mock("../../auth/client", () => ({
  authClient: { changeEmail: jest.fn() },
}));

const changeEmail = jest.mocked(authClient.changeEmail);

async function renderForm(locale: "en" | "nl" = "en") {
  const user = userEvent.setup();

  await render(
    <TestProviders locale={locale}>
      <ChangeEmailForm email="ada@example.com" />
    </TestProviders>,
  );

  async function request(address: string) {
    await user.type(screen.getByLabelText("New email address"), address);
    await user.press(
      screen.getByRole("button", { name: "Send confirmation link" }),
    );
  }

  return { request, user };
}

describe("ChangeEmailForm", () => {
  beforeEach(() => {
    changeEmail.mockReset();
    changeEmail.mockResolvedValue({ data: {}, error: null });
  });

  it("shows the address the account currently uses", async () => {
    await renderForm();

    expect(screen.getByText("ada@example.com")).toBeVisible();
  });

  it("asks the auth server to confirm from the current inbox", async () => {
    const { request } = await renderForm();

    await request("grace@example.com");

    expect(changeEmail).toHaveBeenCalledWith({ newEmail: "grace@example.com" });
  });

  it("names both inboxes in the order the reader must open them", async () => {
    const { request } = await renderForm();

    await request("grace@example.com");

    const notice = await screen.findByText(
      /the address you are signed in with/,
    );
    expect(notice).toHaveTextContent(/ada@example\.com/);
    expect(notice).toHaveTextContent(/grace@example\.com/);
  });

  it("refuses an address that is not an email without reaching the auth server", async () => {
    const { request } = await renderForm();

    await request("grace");

    expect(
      await screen.findByText("Enter a valid email address."),
    ).toBeVisible();
    expect(changeEmail).not.toHaveBeenCalled();
  });

  it("refuses the address the account already uses", async () => {
    const { request } = await renderForm();

    await request("Ada@Example.com");

    expect(
      await screen.findByText("That is already your email address."),
    ).toBeVisible();
    expect(changeEmail).not.toHaveBeenCalled();
  });

  it("renders in Dutch when the locale is Dutch", async () => {
    await renderForm("nl");

    expect(
      screen.getByRole("button", { name: "Bevestigingslink versturen" }),
    ).toBeVisible();
  });
});
