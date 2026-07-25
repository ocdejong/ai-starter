import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IntlTestProvider } from "~/test/intl";
import { AppShell } from "./app-shell";

const pathname = vi.hoisted(() => ({ current: "/dashboard" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("~/server/better-auth/client", () => ({
  authClient: {
    organization: { setActive: vi.fn() },
    signOut: vi.fn(() => Promise.resolve({ error: null })),
    // The shell mounts the group switcher, which reads these stores. The
    // switcher's own suite covers what it does with them; here they only have to
    // resolve so the header renders.
    useActiveOrganization: () => ({ data: { id: "group-1", name: "Group" } }),
    useListOrganizations: () => ({
      data: [{ id: "group-1", name: "Group", slug: "group" }],
    }),
  },
}));

function renderShell(locale: "en" | "nl" = "en") {
  return render(
    <IntlTestProvider locale={locale}>
      <AppShell user={{ email: "ada@example.com", name: "Ada Lovelace" }}>
        <p>The page.</p>
      </AppShell>
    </IntlTestProvider>,
  );
}

describe("AppShell", () => {
  beforeEach(() => {
    pathname.current = "/dashboard";
  });

  it("renders the page it wraps", () => {
    renderShell();

    expect(screen.getByText("The page.")).toBeInTheDocument();
  });

  it("links to the dashboard and to settings", () => {
    renderShell();

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
  });

  it("marks the section the visitor is in as the current page", () => {
    pathname.current = "/settings/account";
    renderShell();

    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("names the signed-in account before the menu is opened", () => {
    renderShell();

    expect(
      screen.getByRole("button", { name: "Ada Lovelace" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("ada@example.com")).toBeNull();
  });

  it("offers the profile and the way out once the menu is opened", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "Ada Lovelace" }));

    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "href",
      "/settings/account",
    );
    expect(
      screen.getByRole("button", { name: "Sign out" }),
    ).toBeInTheDocument();
  });

  it("surfaces the theme and locale controls the signed-out pages already have", () => {
    renderShell();

    expect(screen.getByRole("group", { name: "Theme" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Language" })).toBeInTheDocument();
  });

  it("renders in Dutch under the Dutch catalog", async () => {
    const user = userEvent.setup();
    renderShell("nl");

    expect(
      screen.getByRole("link", { name: "Instellingen" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ada Lovelace" }));

    expect(
      screen.getByRole("button", { name: "Uitloggen" }),
    ).toBeInTheDocument();
  });
});
