import { createTRPCRouter, groupProcedure, protectedProcedure } from "../trpc";

export const groupRouter = createTRPCRouter({
  /** Every group the caller belongs to, for the switcher. */
  list: protectedProcedure.query(({ ctx }) =>
    ctx.groups.listMemberships(ctx.session.user.id),
  ),

  /** The active group, as re-derived by `groupProcedure`, plus the caller's role. */
  current: groupProcedure.query(({ ctx }) => ctx.group),

  /**
   * The active group's members. It deliberately takes no group id: the only
   * group this can read is the one the caller's membership was just verified
   * against.
   */
  members: groupProcedure.query(({ ctx }) =>
    ctx.groups.listMembers(ctx.group.groupId),
  ),
});
