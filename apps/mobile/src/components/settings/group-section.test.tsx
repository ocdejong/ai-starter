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

function query(data: unknown, isPending = false) {
  return { data, error: null, isPending, refetch: jest.fn() };
}

function group(members: unknown[] = [owner, plainMember]) {
  return {
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
    useActiveMember.mockReturnValue(query(owner) as never);
    useActiveOrganization.mockReturnValue(query(group()) as never);
    useListOrganizations.mockReturnValue(
      query([
        { id: "group-1", name: "Book Club" },
        { id: "group-2", name: "Ada Lovelace" },
      ]) as never,
    );
  });

  it("waits rather than claiming the account has no group", async () => {
    useActiveOrganization.mockReturnValue(query(null, true) as never);
    await renderSection();

    expect(screen.getByText("Loading your groups…")).toBeOnTheScreen();
    expect(screen.queryByText("You are not in a group")).toBeNull();
  });

  it("offers a first group when the session has no active one", async () => {
    useActiveOrganization.mockReturnValue(query(null) as never);
    useListOrganizations.mockReturnValue(query([]) as never);
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
    useActiveMember.mockReturnValue(query(plainMember) as never);
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
    useActiveOrganization.mockReturnValue(query(group([owner])) as never);
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
