import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IntlTestProvider } from "~/test/intl";
import { GroupSettings } from "./group-settings";

const mocks = vi.hoisted(() => ({
  delete: vi.fn(),
  leave: vi.fn(),
  refresh: vi.fn(),
  setActive: vi.fn(),
  update: vi.fn(),
  useActiveMember: vi.fn(),
  useActiveOrganization: vi.fn(),
  useListOrganizations: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

// `checkRolePermission` is the real one: it answers from Better Auth's own
// access-control definition, which is the whole reason the interface asks it
// instead of comparing role names itself. A fake here would prove nothing.
vi.mock("~/server/better-auth/client", async () => {
  const { clientSideHasPermission } =
    await import("better-auth/client/plugins");

  return {
    authClient: {
      organization: {
        checkRolePermission: (data: {
          role: string;
          permissions: Record<string, string[]>;
        }) => clientSideHasPermission({ ...data, options: {} }),
        create: vi.fn(),
        delete: mocks.delete,
        inviteMember: vi.fn(),
        leave: mocks.leave,
        removeMember: vi.fn(),
        setActive: mocks.setActive,
        update: mocks.update,
        updateMemberRole: vi.fn(),
      },
      useActiveMember: mocks.useActiveMember,
      useActiveOrganization: mocks.useActiveOrganization,
      useListOrganizations: mocks.useListOrganizations,
    },
  };
});

const owner = {
  id: "member-1",
  role: "owner",
  user: { email: "ada@example.com", id: "user-1", name: "Ada Lovelace" },
  userId: "user-1",
};
const plainMember = {
  id: "member-2",
  role: "member",
  user: { email: "alan@example.com", id: "user-2", name: "Alan Turing" },
  userId: "user-2",
};

function group(
  overrides: { members?: unknown[]; invitations?: unknown[] } = {},
) {
  return {
    id: "group-1",
    invitations: overrides.invitations ?? [],
    members: overrides.members ?? [owner, plainMember],
    name: "Book Club",
    slug: "book-club-abc",
  };
}

function query(data: unknown, isPending = false) {
  return { data, error: null, isPending, refetch: vi.fn() };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.leave.mockResolvedValue({ data: {}, error: null });
  mocks.setActive.mockResolvedValue({ data: {}, error: null });
  mocks.useActiveMember.mockReturnValue(query(owner));
  mocks.useActiveOrganization.mockReturnValue(query(group()));
  mocks.useListOrganizations.mockReturnValue(
    query([
      { id: "group-1", name: "Book Club", slug: "book-club-abc" },
      { id: "group-2", name: "Ada Lovelace", slug: "personal-1" },
    ]),
  );
});

function renderSettings() {
  return render(
    <IntlTestProvider>
      <GroupSettings />
    </IntlTestProvider>,
  );
}

describe("GroupSettings", () => {
  it("waits rather than claiming the account has no group", () => {
    mocks.useActiveOrganization.mockReturnValue(query(null, true));
    renderSettings();

    expect(screen.getByText("Loading your groups…")).toBeVisible();
    expect(screen.queryByText("You are not in a group")).toBeNull();
  });

  it("offers a first group when the session has no active one", () => {
    mocks.useActiveOrganization.mockReturnValue(query(null));
    mocks.useListOrganizations.mockReturnValue(query([]));
    renderSettings();

    expect(screen.getByText("You are not in a group")).toBeVisible();
    expect(screen.getByRole("button", { name: "Create group" })).toBeVisible();
    // There is nothing to manage, so nothing about members is shown.
    expect(screen.queryByText("Members")).toBeNull();
  });

  it("gives an owner the whole surface", () => {
    renderSettings();

    expect(screen.getByLabelText("Group name")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Send invitation" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Delete group" })).toBeVisible();
  });

  describe("the personal group", () => {
    // The auth server refuses to delete, leave or rename it, so the screen must
    // not offer what would only be refused.
    function openPersonalGroup() {
      mocks.useActiveOrganization.mockReturnValue(
        query({ ...group(), slug: "personal-user-1" }),
      );
      return renderSettings();
    }

    it("offers neither leaving nor deleting", () => {
      openPersonalGroup();

      expect(screen.getByText("Members")).toBeVisible();
      expect(screen.queryByRole("button", { name: "Delete group" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Leave group" })).toBeNull();
    });

    it("shows the name and says it cannot be changed", () => {
      openPersonalGroup();

      expect(screen.getByText("Book Club")).toBeVisible();
      expect(screen.queryByLabelText("Group name")).toBeNull();
      expect(
        screen.getByText("Your personal group cannot be renamed."),
      ).toBeVisible();
    });

    it("waits for the active member before deciding what to offer", () => {
      mocks.useActiveMember.mockReturnValue(query(undefined, true));
      openPersonalGroup();

      // Without the member the screen cannot tell whose personal group this is,
      // and would flash controls the server refuses.
      expect(screen.getByText("Loading your groups…")).toBeVisible();
      expect(screen.queryByRole("button", { name: "Delete group" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Leave group" })).toBeNull();
    });

    // Only the owner's own screen hides the controls, so a member of someone
    // else's personal group can still ask for what the server refuses. What they
    // read then is the refusal in their own language, not the server's English
    // sentence and not the generic failure.
    describe("when the server refuses a change to someone else's", () => {
      const refusal = {
        data: null,
        error: {
          code: "PERSONAL_GROUP_REQUIRED",
          message: "A personal group cannot be removed or renamed.",
        },
      };

      beforeEach(() => {
        mocks.useActiveOrganization.mockReturnValue(
          query({ ...group(), slug: "personal-user-2" }),
        );
      });

      function expectPersonalGroupCopy() {
        expect(screen.getByRole("alert")).toHaveTextContent(
          "A personal group cannot be renamed or deleted.",
        );
        expect(screen.queryByText(/something went wrong/i)).toBeNull();
        expect(screen.queryByText(refusal.error.message)).toBeNull();
      }

      it("explains a refused rename", async () => {
        mocks.update.mockResolvedValue(refusal);
        const user = userEvent.setup();
        renderSettings();

        await user.clear(screen.getByLabelText("Group name"));
        await user.type(screen.getByLabelText("Group name"), "Mine now");
        await user.click(screen.getByRole("button", { name: "Save name" }));

        await screen.findByRole("alert");
        expectPersonalGroupCopy();
      });

      it("explains a refused deletion", async () => {
        mocks.delete.mockResolvedValue(refusal);
        const user = userEvent.setup();
        renderSettings();

        await user.click(screen.getByRole("button", { name: "Delete group" }));
        await user.click(screen.getByRole("button", { name: "Yes, continue" }));

        await screen.findByRole("alert");
        expectPersonalGroupCopy();
      });
    });

    it("keeps the full surface for someone else's group named like it", () => {
      // Only the slug of the viewer's own personal group marks it.
      mocks.useActiveOrganization.mockReturnValue(
        query({ ...group(), slug: "personal-user-2" }),
      );
      renderSettings();

      expect(screen.getByLabelText("Group name")).toBeVisible();
      expect(
        screen.getByRole("button", { name: "Delete group" }),
      ).toBeVisible();
    });
  });

  it("withholds every owner affordance from a plain member", () => {
    mocks.useActiveMember.mockReturnValue(query(plainMember));
    renderSettings();

    // The name is readable, the field is not there to be found.
    expect(screen.getByText("Book Club")).toBeVisible();
    expect(screen.queryByLabelText("Group name")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Send invitation" }),
    ).toBeNull();
    expect(screen.queryByText("Pending invitations")).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete group" })).toBeNull();
    // Leaving is not an owner affordance — anyone but the last owner may.
    expect(screen.getByRole("button", { name: "Leave group" })).toBeVisible();
  });

  it("tells the only owner how to leave instead of offering a refusal", () => {
    mocks.useActiveOrganization.mockReturnValue(
      query(group({ members: [owner] })),
    );
    renderSettings();

    expect(
      screen.getByText(
        "You are the only owner of Book Club. Make someone else an owner before you leave, or delete the group instead.",
      ),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Leave group" })).toBeNull();
  });

  it("moves to a group that remains after leaving one", async () => {
    const user = userEvent.setup();
    // The only owner cannot leave, so the member is the one who can.
    mocks.useActiveMember.mockReturnValue(query(plainMember));
    renderSettings();

    await user.click(screen.getByRole("button", { name: "Leave group" }));
    await user.click(screen.getByRole("button", { name: "Yes, continue" }));

    expect(mocks.leave).toHaveBeenCalledWith({ organizationId: "group-1" });
    // Leaving clears the session's active group, so something has to name the
    // next one or every group-scoped request afterwards has none.
    await vi.waitFor(() => {
      expect(mocks.setActive).toHaveBeenCalledWith({
        organizationId: "group-2",
      });
    });
  });

  it("lists a pending invitation and hides one that has expired", () => {
    const hour = 60 * 60 * 1000;
    mocks.useActiveOrganization.mockReturnValue(
      query(
        group({
          invitations: [
            {
              email: "reader@example.com",
              expiresAt: new Date(Date.now() + hour).toISOString(),
              id: "invitation-1",
              role: "member",
              status: "pending",
            },
            {
              email: "stale@example.com",
              expiresAt: new Date(Date.now() - hour).toISOString(),
              id: "invitation-2",
              role: "member",
              status: "pending",
            },
            {
              email: "joined@example.com",
              expiresAt: new Date(Date.now() + hour).toISOString(),
              id: "invitation-3",
              role: "member",
              status: "accepted",
            },
          ],
        }),
      ),
    );
    renderSettings();

    expect(screen.getByText("reader@example.com")).toBeVisible();
    // An expired invitation is refused as a missing one, so listing it would
    // promise a link that no longer works.
    expect(screen.queryByText("stale@example.com")).toBeNull();
    expect(screen.queryByText("joined@example.com")).toBeNull();
  });
});
