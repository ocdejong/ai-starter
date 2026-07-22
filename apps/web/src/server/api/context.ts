import { createTRPCContext as createSharedTRPCContext } from "@t3-test/api";
import { db } from "@t3-test/db";

import { auth } from "~/server/better-auth";

export const createTRPCContext = async (options: { headers: Headers }) => {
  const session = await auth.api.getSession({
    headers: options.headers,
  });

  return createSharedTRPCContext({
    db,
    headers: options.headers,
    session,
  });
};
