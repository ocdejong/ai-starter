import { createTRPCContext as createSharedTRPCContext } from "@t3-test/api";
import type { PostRepository } from "@t3-test/api";
import { prismaPostRepository } from "@t3-test/db";

import { auth } from "~/server/better-auth";

const posts: PostRepository = prismaPostRepository;

export const createTRPCContext = async (options: { headers: Headers }) => {
  const session = await auth.api.getSession({
    headers: options.headers,
  });

  return createSharedTRPCContext({
    headers: options.headers,
    posts,
    session,
  });
};
