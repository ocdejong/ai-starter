import { describe, expect, it, vi } from "vitest";

import type {
  GroupMember,
  GroupMembership,
  GroupRepository,
  TRPCContext,
  TRPCSession,
} from "../context";
import { createCaller } from "../root";

const ownMembership: GroupMembership = {
  groupId: "group-a",
  name: "Group A",
  role: "owner",
  slug: "group-a",
};

const ownMembers: GroupMember[] = [
  {
    email: "member@example.com",
    id: "member-1",
    name: "A Member",
    role: "owner",
    userId: "user-1",
  },
];

/**
 * A repository that only ever answers for the group the user really belongs
 * to. Asking about any other group returns `null`, exactly as the database
 * adapter's membership lookup does.
 */
function groupsForMemberOfA(): GroupRepository {
  return {
    findMembership: vi.fn(async ({ groupId, userId }) =>
      groupId === "group-a" && userId === "user-1" ? ownMembership : null,
    ),
    listMembers: vi.fn(async (groupId: string) =>
      groupId === "group-a" ? ownMembers : [],
    ),
    listMemberships: vi.fn(async () => [ownMembership]),
  };
}

const createContext = (
  groups: GroupRepository,
  session: TRPCSession,
): TRPCContext => ({
  groups,
  headers: new Headers(),
  posts: {
    create: vi.fn(),
    findLatestByUserId: vi.fn(async () => null),
  },
  session,
});

const signedIn = (activeGroupId: string | null): TRPCSession => ({
  activeGroupId,
  user: { id: "user-1" },
});

describe("groupRouter", () => {
  it("lists the groups the signed-in user belongs to", async () => {
    const groups = groupsForMemberOfA();

    const result = await createCaller(
      createContext(groups, signedIn("group-a")),
    ).group.list();

    expect(groups.listMemberships).toHaveBeenCalledWith("user-1");
    expect(result).toEqual([ownMembership]);
  });

  it("resolves the active group by re-deriving the membership", async () => {
    const groups = groupsForMemberOfA();

    const result = await createCaller(
      createContext(groups, signedIn("group-a")),
    ).group.current();

    expect(groups.findMembership).toHaveBeenCalledWith({
      groupId: "group-a",
      userId: "user-1",
    });
    expect(result).toEqual(ownMembership);
  });

  it("reads members of the verified group", async () => {
    const groups = groupsForMemberOfA();

    const result = await createCaller(
      createContext(groups, signedIn("group-a")),
    ).group.members();

    expect(groups.listMembers).toHaveBeenCalledWith("group-a");
    expect(result).toEqual(ownMembers);
  });

  it("refuses a session pointing at a group the caller does not belong to", async () => {
    // The session's active group is the one value a client can influence and
    // the cookie cache can serve stale. A member of group A carrying "group-b"
    // must be refused rather than served group B — the Dokploy cross-group IDOR
    // (GHSA-f8wj-5c4w-frhg) is exactly this read succeeding.
    const groups = groupsForMemberOfA();
    const caller = createCaller(createContext(groups, signedIn("group-b")));

    await expect(caller.group.current()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(caller.group.members()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(groups.listMembers).not.toHaveBeenCalled();
  });

  it("refuses a session with no active group", async () => {
    const groups = groupsForMemberOfA();

    await expect(
      createCaller(createContext(groups, signedIn(null))).group.current(),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(groups.findMembership).not.toHaveBeenCalled();
  });

  it("refuses a signed-out caller before it looks at any group", async () => {
    const groups = groupsForMemberOfA();

    await expect(
      createCaller(createContext(groups, null)).group.current(),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(groups.findMembership).not.toHaveBeenCalled();
  });
});
