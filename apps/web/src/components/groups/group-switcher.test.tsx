import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IntlTestProvider } from "~/test/intl";
import { GroupSwitcher } from "./group-switcher";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  setActive: vi.fn(),
  useActiveOrganization: vi.fn(),
  useListOrganizations: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("~/server/better-auth/client", () => ({
  authClient: {
    organization: { setActive: mocks.setActive },
    useActiveOrganization: mocks.useActiveOrganization,
    useListOrganizations: mocks.useListOrganizations,
  },
}));

const groups = [
  { id: "group-1", name: "Ada Lovelace", slug: "personal-1" },
  { id: "group-2", name: "Book Club", slug: "book-club-abc" },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.setActive.mockResolvedValue({ data: groups[1], error: null });
  mocks.useActiveOrganization.mockReturnValue({ data: groups[0] });
  mocks.useListOrganizations.mockReturnValue({ data: groups });
});

function renderSwitcher(locale: "en" | "nl" = "en") {
  return render(
    <IntlTestProvider locale={locale}>
      <GroupSwitcher />
    </IntlTestProvider>,
  );
}

describe("GroupSwitcher", () => {
  it("offers every group the account belongs to, with the active one chosen", () => {
    renderSwitcher();

    const select = screen.getByLabelText("Active group");
    expect(
      Array.from(select.querySelectorAll("option")).map(
        (option) => option.textContent,
      ),
    ).toEqual(["Ada Lovelace", "Book Club"]);
    expect(select).toHaveValue("group-1");
  });

  it("switches to the chosen group and re-renders the pages that read it", async () => {
    const user = userEvent.setup();
    renderSwitcher();

    await user.selectOptions(screen.getByLabelText("Active group"), "group-2");

    expect(mocks.setActive).toHaveBeenCalledWith({ organizationId: "group-2" });
    // Server components decide what to show from the session's active group, so
    // the switch only lands once they are asked again.
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("renders nothing while the account has no group to switch between", () => {
    mocks.useActiveOrganization.mockReturnValue({ data: null });
    mocks.useListOrganizations.mockReturnValue({ data: [] });

    const { container } = renderSwitcher();

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("names the control in the reader's language", () => {
    renderSwitcher("nl");

    expect(screen.getByLabelText("Actieve groep")).toBeVisible();
  });
});
