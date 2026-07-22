import "server-only";

import { db } from "./client";

type CreatePostParameters = {
  createdById: string;
  name: string;
};

export const prismaPostRepository = {
  create: ({ createdById, name }: CreatePostParameters) =>
    db.post.create({
      data: {
        createdById,
        name,
      },
    }),
  findLatestByUserId: (userId: string) =>
    db.post.findFirst({
      orderBy: { createdAt: "desc" },
      where: { createdById: userId },
    }),
};
