import { createTRPCContext as createSharedTRPCContext } from "@ai-starter/api";
import type { PostRepository } from "@ai-starter/api";
import { prismaPostRepository } from "@ai-starter/db";

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
