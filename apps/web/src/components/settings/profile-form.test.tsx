import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IntlTestProvider } from "~/test/intl";
import { ProfileForm } from "./profile-form";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("~/server/better-auth/client", () => ({
  authClient: { updateUser: mocks.updateUser },
}));

function renderForm(locale: "en" | "nl" = "en") {
  return render(
    <IntlTestProvider locale={locale}>
      <ProfileForm name="Ada Lovelace" />
    </IntlTestProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateUser.mockResolvedValue({ data: {}, error: null });
});

describe("ProfileForm", () => {
  it("starts from the name the account already has", () => {
    renderForm();

    expect(screen.getByLabelText("Name")).toHaveValue("Ada Lovelace");
  });

  it("saves a trimmed name and refreshes the chrome that shows it", async () => {
    const user = userEvent.setup();
    renderForm();

    const field = screen.getByLabelText("Name");
    await user.clear(field);
    await user.type(field, "  Grace Hopper  ");
    await user.click(screen.getByRole("button", { name: "Save name" }));

    expect(mocks.updateUser).toHaveBeenCalledWith({ name: "Grace Hopper" });
    expect(
      await screen.findByText("Your name has been updated."),
    ).toBeVisible();
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("refuses an empty name without reaching the auth server", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.clear(screen.getByLabelText("Name"));
    await user.click(screen.getByRole("button", { name: "Save name" }));

    expect(await screen.findByText("Enter your name.")).toBeVisible();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("reports a refused save instead of claiming it worked", async () => {
    mocks.updateUser.mockResolvedValue({ error: { code: "UNKNOWN" } });
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Save name" }));

    expect(
      await screen.findByText("Something went wrong. Please try again."),
    ).toBeVisible();
    expect(screen.queryByText("Your name has been updated.")).toBeNull();
  });

  it("renders in Dutch when the locale is Dutch", () => {
    renderForm("nl");

    expect(screen.getByRole("button", { name: "Naam opslaan" })).toBeVisible();
  });
});
