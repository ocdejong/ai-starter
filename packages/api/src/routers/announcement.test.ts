import { TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";

import type {
  AnnouncementRecord,
  AnnouncementRepository,
  GroupMembership,
  GroupRepository,
  TRPCContext,
  TRPCSession,
} from "../context";
import { createCaller } from "../root";

const ownMembership: GroupMembership = {
  groupId: "group-a",
  name: "Group A",
  role: "member",
  slug: "group-a",
};

const stored: AnnouncementRecord = {
  id: "announcement-1",
  isCurrent: true,
  title: "Office closed on Friday",
};

/**
 * A repository that only ever answers for the group the caller belongs to,
 * exactly as the database adapter's group-keyed queries do: another group's
 * identifier matches no row.
 */
function announcementsOfGroupA(): AnnouncementRepository {
  // Written as a plain typed object first so each callback is contextually
  // typed; `vi.fn` then only adds the recording.
  const repository: AnnouncementRepository = {
    listByGroup: async (groupId) => (groupId === "group-a" ? [stored] : []),
    publish: async ({ title }) => ({ ...stored, title }),
    rename: async ({ announcementId, groupId, title }) =>
      groupId === "group-a" && announcementId === stored.id
        ? { ...stored, title }
        : null,
  };

  return {
    listByGroup: vi.fn(repository.listByGroup),
    publish: vi.fn(repository.publish),
    rename: vi.fn(repository.rename),
  };
}

/** Membership in group A and nothing else, like the real adapter. */
function groupsForMemberOfA(): GroupRepository {
  return {
    findMembership: vi.fn(async ({ groupId, userId }) =>
      groupId === "group-a" && userId === "user-1" ? ownMembership : null,
    ),
    listMembers: vi.fn(async () => []),
    listMemberships: vi.fn(async () => [ownMembership]),
  };
}

const createContext = (
  announcements: AnnouncementRepository,
  session: TRPCSession,
): TRPCContext => ({
  announcements,
  groups: groupsForMemberOfA(),
  headers: new Headers(),
  session,
});

const signedIn = (activeGroupId: string | null): TRPCSession => ({
  activeGroupId,
  user: { id: "user-1" },
});

describe("announcementRouter", () => {
  it("lists the active group's announcements and nothing else", async () => {
    const announcements = announcementsOfGroupA();

    const result = await createCaller(
      createContext(announcements, signedIn("group-a")),
    ).announcement.list();

    expect(announcements.listByGroup).toHaveBeenCalledWith("group-a");
    expect(result).toEqual([stored]);
  });

  it("publishes into the group the request was made in", async () => {
    const announcements = announcementsOfGroupA();

    const result = await createCaller(
      createContext(announcements, signedIn("group-a")),
    ).announcement.publish({ title: "  Standup moves to 10:00  " });

    expect(announcements.publish).toHaveBeenCalledWith({
      createdById: "user-1",
      groupId: "group-a",
      title: "Standup moves to 10:00",
    });
    expect(result.title).toBe("Standup moves to 10:00");
  });

  it("renames an announcement of the active group", async () => {
    const announcements = announcementsOfGroupA();

    const result = await createCaller(
      createContext(announcements, signedIn("group-a")),
    ).announcement.rename({
      announcementId: "announcement-1",
      title: "Office closed all week",
    });

    expect(announcements.rename).toHaveBeenCalledWith({
      announcementId: "announcement-1",
      groupId: "group-a",
      title: "Office closed all week",
    });
    expect(result.title).toBe("Office closed all week");
  });

  it("refuses an identifier that belongs to another group", async () => {
    const announcements = announcementsOfGroupA();

    await expect(
      createCaller(
        createContext(announcements, signedIn("group-a")),
      ).announcement.rename({
        announcementId: "announcement-of-group-b",
        title: "Not mine",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuses a caller whose session names a group they are not in", async () => {
    const announcements = announcementsOfGroupA();

    await expect(
      createCaller(
        createContext(announcements, signedIn("group-b")),
      ).announcement.list(),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(announcements.listByGroup).not.toHaveBeenCalled();
  });

  it("refuses a caller with no active group", async () => {
    const announcements = announcementsOfGroupA();

    await expect(
      createCaller(
        createContext(announcements, signedIn(null)),
      ).announcement.list(),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("refuses a signed-out caller", async () => {
    const announcements = announcementsOfGroupA();

    await expect(
      createCaller(createContext(announcements, null)).announcement.list(),
    ).rejects.toBeInstanceOf(TRPCError);
    expect(announcements.listByGroup).not.toHaveBeenCalled();
  });

  it("rejects a blank title before the repository is reached", async () => {
    const announcements = announcementsOfGroupA();

    await expect(
      createCaller(
        createContext(announcements, signedIn("group-a")),
      ).announcement.publish({ title: "   " }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(announcements.publish).not.toHaveBeenCalled();
  });
});
