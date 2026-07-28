import {
  createAnnouncementInputSchema,
  renameAnnouncementInputSchema,
} from "@ai-starter/domain";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, groupProcedure } from "../trpc";

/**
 * Announcements belong to a group, so every procedure here is a
 * `groupProcedure`: the group comes from the verified membership behind the
 * request and never from the input. That is what makes reading or writing
 * another group's announcements impossible rather than merely checked — copy
 * this shape for any group-owned feature.
 */
export const announcementRouter = createTRPCRouter({
  /** The active group's announcements, newest first. It takes no group id. */
  list: groupProcedure.query(({ ctx }) =>
    ctx.announcements.listByGroup(ctx.group.groupId),
  ),

  /**
   * Publishes an announcement and makes it the group's current one. The
   * repository does both writes in a single transaction, because a group with
   * two current announcements — or none, after a half-applied change — is a
   * state the interface has no way to describe.
   */
  create: groupProcedure
    .input(createAnnouncementInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.announcements.create({
        createdById: ctx.session.user.id,
        groupId: ctx.group.groupId,
        title: input.title,
      }),
    ),

  /**
   * Renames one of the active group's announcements. The identifier arrives from
   * the caller and is therefore never trusted alone: it is paired with the
   * verified group, and an identifier from anywhere else matches no row.
   */
  rename: groupProcedure
    .input(renameAnnouncementInputSchema)
    .mutation(async ({ ctx, input }) => {
      const renamed = await ctx.announcements.rename({
        announcementId: input.announcementId,
        groupId: ctx.group.groupId,
        title: input.title,
      });

      if (renamed === null) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "This group has no such announcement.",
        });
      }

      return renamed;
    }),
});
