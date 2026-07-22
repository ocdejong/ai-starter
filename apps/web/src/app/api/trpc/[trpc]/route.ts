import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@ai-starter/api";
import { type NextRequest } from "next/server";

import { env } from "~/env";
import { createTRPCContext } from "~/server/api/context";

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a HTTP request (e.g. when you make requests from Client Components).
 */
const createContext = async (req: NextRequest) => {
  return createTRPCContext({
    headers: req.headers,
  });
};

const handler = (req: NextRequest) => {
  const options = {
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext(req),
  };

  if (env.NODE_ENV === "development") {
    return fetchRequestHandler({
      ...options,
      onError: ({ path, error }) => {
        console.error(
          `❌ tRPC failed on ${path ?? "<no-path>"}: ${error.message}`,
        );
      },
    });
  }

  return fetchRequestHandler(options);
};

export { handler as GET, handler as POST };
