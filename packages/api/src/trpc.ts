import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import type { TRPCContext } from "./context";

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;

const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();
  const elapsedMs = Date.now() - start;

  console.log(`[TRPC] ${path} took ${elapsedMs}ms`);

  return result;
});

export const publicProcedure = t.procedure.use(timingMiddleware);

export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    return next({
      ctx: {
        session: { ...ctx.session, user: ctx.session.user },
      },
    });
  });

/**
 * A procedure scoped to one group. It takes no group identifier from the
 * caller: the candidate comes from the session, and the membership behind it is
 * re-derived from the database on every call. Neither half is trusted alone —
 * the session says which group was last chosen, the database says whether this
 * user may still be there — and the procedure hands downstream code only the
 * verified `ctx.group`.
 *
 * Serving a group because the session named it is the Dokploy cross-group IDOR
 * (GHSA-f8wj-5c4w-frhg). Every group-scoped query filters by `ctx.group.groupId`
 * and never by an input, which is what makes reaching another group impossible
 * rather than merely checked.
 */
export const groupProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const { activeGroupId } = ctx.session;
  if (activeGroupId === null) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "This request needs an active group.",
    });
  }

  const group = await ctx.groups.findMembership({
    groupId: activeGroupId,
    userId: ctx.session.user.id,
  });
  if (group === null) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not a member of the active group.",
    });
  }

  return next({ ctx: { group } });
});
