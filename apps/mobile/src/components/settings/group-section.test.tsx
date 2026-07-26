import { render, screen } from "@testing-library/react-native";

import { authClient } from "../../auth/client";
import { TestProviders } from "../../test/providers";
import { GroupSection } from "./group-section";

/**
 * `checkRolePermission` is restated here rather than imported.
 *
 * Better Auth ships ESM in `.mjs`, which jest-expo's transform never matches, so
 * the real client cannot load in this suite at all (stage 08). The web suite
 * exercises Better Auth's own access control against the same interface; this
 * fake only has to answer for three roles, and it is written from the same
 * definition: an owner may do everything, an admin everything but delete the
 * group, a member nothing.
 */
jest.mock("../../auth/client", () => {
  const allowed: Record<string, readonly string[]> = {
    admin: ["organization:update", "invitation:create", "member:update"],
    member: [],
    owner: [
      "organization:update",
      "organization:delete",
      "invitation:create",
      "member:update",
    ],
  };

  return {
    authClient: {
      organization: {
        checkRolePermission: ({
          permissions,
          role,
        }: {
          permissions: Record<string, readonly string[]>;
          role: string;
        }) =>
          Object.entries(permissions).every(([resource, actions]) =>
            actions.every((action) =>
              (allowed[role] ?? []).includes(`${resource}:${action}`),
            ),
          ),
        setActive: jest.fn(),
      },
      useActiveMember: jest.fn(),
      useActiveOrganization: jest.fn(),
      useListOrganizations: jest.fn(),
    },
  };
});

const useActiveMember = jest.mocked(authClient.useActiveMember);
const useActiveOrganization = jest.mocked(authClient.useActiveOrganization);
const useListOrganizations = jest.mocked(authClient.useListOrganizations);

// Fixtures carry every field Better Auth's own row types declare, not only the
// ones this screen reads, so the hooks can be stood in for without an assertion
// — and a field the plugin adds becomes a compiler error rather than a silent
// hole the component quietly reads as undefined.
const createdAt = new Date("2026-01-01T00:00:00.000Z");

const owner = {
  createdAt,
  id: "member-1",
  organizationId: "group-1",
  role: "owner" as const,
  user: { email: "ada@example.com", id: "user-1", name: "Ada Lovelace" },
  userId: "user-1",
};
const plainMember = {
  createdAt,
  id: "member-2",
  organizationId: "group-1",
  role: "member" as const,
  user: { email: "alan@example.com", id: "user-2", name: "Alan Turing" },
  userId: "user-2",
};

function query<T>(data: T, isPending = false) {
  return {
    data,
    error: null,
    isPending,
    isRefetching: false,
    refetch: jest.fn(),
  };
}

type GroupMember = Omit<typeof owner, "role"> & {
  role: "admin" | "member" | "owner";
};

function group(members: GroupMember[] = [owner, plainMember]) {
  return {
    createdAt,
    id: "group-1",
    invitations: [],
    members,
    name: "Book Club",
    slug: "book-club-abc",
  };
}

async function renderSection(locale: "en" | "nl" = "en") {
  await render(
    <TestProviders locale={locale}>
      <GroupSection />
    </TestProviders>,
  );
}

describe("GroupSection", () => {
  beforeEach(() => {
    useActiveMember.mockReturnValue(query(owner));
    useActiveOrganization.mockReturnValue(query(group()));
    useListOrganizations.mockReturnValue(
      query([
        { createdAt, id: "group-1", name: "Book Club", slug: "book-club-abc" },
        { createdAt, id: "group-2", name: "Ada Lovelace", slug: "personal-1" },
      ]),
    );
  });

  it("waits rather than claiming the account has no group", async () => {
    useActiveOrganization.mockReturnValue(query(null, true));
    await renderSection();

    expect(screen.getByText("Loading your groups…")).toBeOnTheScreen();
    expect(screen.queryByText("You are not in a group")).toBeNull();
  });

  it("offers a first group when the session has no active one", async () => {
    useActiveOrganization.mockReturnValue(query(null));
    useListOrganizations.mockReturnValue(query([]));
    await renderSection();

    expect(screen.getByText("You are not in a group")).toBeOnTheScreen();
    expect(
      screen.getByRole("button", { name: "Create group" }),
    ).toBeOnTheScreen();
    expect(screen.queryByText("Members")).toBeNull();
  });

  it("gives an owner the whole surface", async () => {
    await renderSection();

    expect(screen.getByLabelText("Group name")).toBeOnTheScreen();
    expect(
      screen.getByRole("button", { name: "Send invitation" }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole("button", { name: "Delete group" }),
    ).toBeOnTheScreen();
  });

  it("withholds every owner affordance from a plain member", async () => {
    useActiveMember.mockReturnValue(query(plainMember));
    await renderSection();

    expect(screen.queryByLabelText("Group name")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Send invitation" }),
    ).toBeNull();
    expect(screen.queryByText("Pending invitations")).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete group" })).toBeNull();
    // Leaving is not an owner affordance — anyone but the last owner may.
    expect(
      screen.getByRole("button", { name: "Leave group" }),
    ).toBeOnTheScreen();
  });

  it("tells the only owner how to leave instead of offering a refusal", async () => {
    useActiveOrganization.mockReturnValue(query(group([owner])));
    await renderSection();

    expect(
      screen.getByText(
        "You are the only owner of Book Club. Make someone else an owner before you leave, or delete the group instead.",
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Leave group" })).toBeNull();
  });

  it("renders in Dutch under the Dutch catalog", async () => {
    await renderSection("nl");

    expect(screen.getByText("Leden")).toBeOnTheScreen();
    expect(
      screen.getByRole("button", { name: "Uitnodiging versturen" }),
    ).toBeOnTheScreen();
  });
});
