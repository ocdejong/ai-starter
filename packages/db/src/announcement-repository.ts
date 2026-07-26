import "server-only";

import type { Database } from "./client";

/** Exactly what the port promises — the row is wider than the contract. */
const announcementFields = { id: true, isCurrent: true, title: true } as const;

/**
 * Reads and writes announcements for the API layer's announcement contract.
 *
 * It is built from an injected client so an integration test can bind it to a
 * throwaway container; the composition root passes the shared singleton. Every
 * statement is keyed by the group, including the update — a repository that
 * offered a lookup by identifier alone would hand the layer above a way to reach
 * another group's rows without meaning to.
 */
export const createPrismaAnnouncementRepository = (database: Database) => ({
  listByGroup: (groupId: string) =>
    database.announcement.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: announcementFields,
      where: { groupId },
    }),

  /**
   * Publishing supersedes the group's current announcement, so the two writes
   * are one transaction: a reader must never see two current announcements, and
   * must never see none because the second statement failed. The partial unique
   * index in the migration refuses the same overlap between *concurrent*
   * transactions, which ordering alone cannot.
   */
  publish: ({
    createdById,
    groupId,
    title,
  }: {
    createdById: string;
    groupId: string;
    title: string;
  }) =>
    database.$transaction(async (transaction) => {
      await transaction.announcement.updateMany({
        data: { isCurrent: false },
        where: { groupId, isCurrent: true },
      });

      return transaction.announcement.create({
        data: { createdById, groupId, isCurrent: true, title },
        select: announcementFields,
      });
    }),

  /**
   * Renames an announcement of one group. The identifier and the group are a
   * single `where`, so an identifier from elsewhere updates no row and the
   * result is `null` rather than someone else's record.
   */
  rename: async ({
    announcementId,
    groupId,
    title,
  }: {
    announcementId: string;
    groupId: string;
    title: string;
  }) => {
    const { count } = await database.announcement.updateMany({
      data: { title },
      where: { groupId, id: announcementId },
    });

    return count === 0
      ? null
      : database.announcement.findUniqueOrThrow({
          select: announcementFields,
          where: { id: announcementId },
        });
  },
});
