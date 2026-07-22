import { createPostInputSchema, helloInputSchema } from "@t3-test/domain";

import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export const postRouter = createTRPCRouter({
  hello: publicProcedure.input(helloInputSchema).query(({ input }) => ({
    greeting: `Hello ${input.text}`,
  })),

  create: protectedProcedure
    .input(createPostInputSchema)
    .mutation(async ({ ctx, input }) =>
      ctx.db.post.create({
        data: {
          name: input.name,
          createdBy: { connect: { id: ctx.session.user.id } },
        },
      }),
    ),

  getLatest: protectedProcedure.query(async ({ ctx }) => {
    const post = await ctx.db.post.findFirst({
      orderBy: { createdAt: "desc" },
      where: { createdBy: { id: ctx.session.user.id } },
    });

    return post ?? null;
  }),

  getSecretMessage: protectedProcedure.query(
    () => "you can now see this secret message!",
  ),
});
