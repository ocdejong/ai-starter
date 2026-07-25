import { render, screen, userEvent } from "@testing-library/react-native";

import { authClient } from "../../auth/client";
import { TestProviders } from "../../test/providers";
import { ProfileForm } from "./profile-form";

jest.mock("../../auth/client", () => ({
  authClient: { updateUser: jest.fn() },
}));

const updateUser = jest.mocked(authClient.updateUser);

async function renderForm(locale: "en" | "nl" = "en") {
  const user = userEvent.setup();

  await render(
    <TestProviders locale={locale}>
      <ProfileForm name="Ada Lovelace" />
    </TestProviders>,
  );

  async function save(name: string) {
    await user.clear(screen.getByLabelText("Name"));
    if (name !== "") {
      await user.type(screen.getByLabelText("Name"), name);
    }
    await user.press(screen.getByRole("button", { name: "Save name" }));
  }

  return { save, user };
}

describe("ProfileForm", () => {
  beforeEach(() => {
    updateUser.mockReset();
    updateUser.mockResolvedValue({ data: {}, error: null } as never);
  });

  it("starts from the name the account already has", async () => {
    await renderForm();

    expect(screen.getByLabelText("Name")).toHaveDisplayValue("Ada Lovelace");
  });

  it("saves a trimmed name", async () => {
    const { save } = await renderForm();

    await save("  Grace Hopper  ");

    expect(updateUser).toHaveBeenCalledWith({ name: "Grace Hopper" });
    expect(
      await screen.findByText("Your name has been updated."),
    ).toBeVisible();
  });

  it("refuses an empty name without reaching the auth server", async () => {
    const { save } = await renderForm();

    await save("");

    expect(await screen.findByText("Enter your name.")).toBeVisible();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("reports a refused save instead of claiming it worked", async () => {
    updateUser.mockResolvedValue({ error: { code: "UNKNOWN" } } as never);
    const { save } = await renderForm();

    await save("Grace Hopper");

    expect(
      await screen.findByText("Something went wrong. Please try again."),
    ).toBeVisible();
    expect(screen.queryByText("Your name has been updated.")).toBeNull();
  });

  it("renders in Dutch when the locale is Dutch", async () => {
    await renderForm("nl");

    expect(screen.getByRole("button", { name: "Naam opslaan" })).toBeVisible();
  });
});
