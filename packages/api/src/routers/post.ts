import { createPostInputSchema, helloInputSchema } from "@t3-test/domain";

import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export const postRouter = createTRPCRouter({
  hello: publicProcedure.input(helloInputSchema).query(({ input }) => ({
    greeting: `Hello ${input.text}`,
  })),

  create: protectedProcedure
    .input(createPostInputSchema)
    .mutation(async ({ ctx, input }) =>
      ctx.posts.create({
        createdById: ctx.session.user.id,
        name: input.name,
      }),
    ),

  getLatest: protectedProcedure.query(({ ctx }) =>
    ctx.posts.findLatestByUserId(ctx.session.user.id),
  ),

  getSecretMessage: protectedProcedure.query(
    () => "you can now see this secret message!",
  ),
});
