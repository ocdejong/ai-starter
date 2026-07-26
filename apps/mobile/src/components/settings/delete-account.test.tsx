import { render, screen, userEvent } from "@testing-library/react-native";

import { authClient } from "../../auth/client";
import { TestProviders } from "../../test/providers";
import { DeleteAccount } from "./delete-account";

jest.mock("../../auth/client", () => ({
  authClient: { deleteUser: jest.fn() },
}));

const deleteUser = jest.mocked(authClient.deleteUser);

async function renderSection(locale: "en" | "nl" = "en") {
  const user = userEvent.setup();

  await render(
    <TestProviders locale={locale}>
      <DeleteAccount email="ada@example.com" />
    </TestProviders>,
  );

  async function open() {
    await user.press(screen.getByRole("button", { name: "Delete account" }));
  }

  return { open, user };
}

describe("DeleteAccount", () => {
  beforeEach(() => {
    deleteUser.mockReset();
    deleteUser.mockResolvedValue({
      data: { message: "Verification email sent", success: true },
      error: null,
    });
  });

  it("asks nothing of the auth server until the deletion is confirmed", async () => {
    const { open } = await renderSection();

    await open();

    expect(deleteUser).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Permanently delete account" }),
    ).toBeDisabled();
  });

  it("only enables the deletion once the account's own address is typed", async () => {
    const { open, user } = await renderSection();
    await open();

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
    const { open, user } = await renderSection();
    await open();

    await user.type(
      screen.getByLabelText("Your email address"),
      "ada@example.com",
    );
    await user.press(
      screen.getByRole("button", { name: "Permanently delete account" }),
    );

    expect(deleteUser).toHaveBeenCalledWith({ callbackURL: "/" });
    expect(
      await screen.findByText(/Nothing has been deleted yet\./),
    ).toBeVisible();
  });

  it("says where the emailed link has to be opened, because this app cannot finish it", async () => {
    const { open, user } = await renderSection();
    await open();

    await user.type(
      screen.getByLabelText("Your email address"),
      "ada@example.com",
    );
    await user.press(
      screen.getByRole("button", { name: "Permanently delete account" }),
    );

    expect(
      await screen.findByText(
        "Open the link on a device where you are signed in to the web application — the emailed link needs that session to finish.",
      ),
    ).toBeVisible();
  });

  it("lets the reader back out without deleting anything", async () => {
    const { open, user } = await renderSection();
    await open();

    await user.press(screen.getByRole("button", { name: "Keep my account" }));

    expect(screen.queryByLabelText("Your email address")).toBeNull();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("reports a refused request instead of claiming an email was sent", async () => {
    deleteUser.mockResolvedValue({ error: { code: "UNKNOWN" } });
    const { open, user } = await renderSection();
    await open();

    await user.type(
      screen.getByLabelText("Your email address"),
      "ada@example.com",
    );
    await user.press(
      screen.getByRole("button", { name: "Permanently delete account" }),
    );

    expect(
      await screen.findByText("Something went wrong. Please try again."),
    ).toBeVisible();
  });

  it("renders in Dutch when the locale is Dutch", async () => {
    await renderSection("nl");

    expect(
      screen.getByRole("button", { name: "Account verwijderen" }),
    ).toBeVisible();
  });
});
