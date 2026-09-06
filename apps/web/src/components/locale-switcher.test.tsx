import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IntlTestProvider } from "~/test/intl";

const { refresh, setLocale } = vi.hoisted(() => ({
  refresh: vi.fn(),
  setLocale: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("~/i18n/set-locale", () => ({ setLocale }));
import { LocaleSwitcher } from "./locale-switcher";

describe("LocaleSwitcher", () => {
  it("waits for the saved locale before refreshing the server tree", async () => {
    let finishSaving: (() => void) | undefined;
    const saved = new Promise<void>((resolve) => {
      finishSaving = resolve;
    });
    setLocale.mockReturnValue(saved);
    const user = userEvent.setup();
    const view = render(
      <IntlTestProvider>
        <LocaleSwitcher />
      </IntlTestProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Nederlands" }));
    expect(setLocale).toHaveBeenCalledWith("nl");
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Nederlands" })).toBeDisabled();
    if (finishSaving === undefined)
      throw new Error("The locale save has not started.");
    finishSaving();
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    view.rerender(
      <IntlTestProvider locale="nl">
        <LocaleSwitcher />
      </IntlTestProvider>,
    );
    expect(screen.getByRole("group", { name: "Taal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nederlands" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
