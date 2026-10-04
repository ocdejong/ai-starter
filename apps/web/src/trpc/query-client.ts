import {
  defaultShouldDehydrateQuery,
  isServer,
  QueryClient,
} from "@tanstack/react-query";
import SuperJSON from "superjson";
import { z } from "zod";

/**
 * The codes that mean "the server understood and said no". Asking again
 * returns the same answer, so a retry only delays the error state — by about
 * seven seconds under TanStack's default backoff — while the screen shows a
 * spinner for a refusal that was final on the first reply.
 */
const nonRetriableQueryCodes = new Set([
  "FORBIDDEN",
  "NOT_FOUND",
  "PRECONDITION_FAILED",
  "UNAUTHORIZED",
]);

const trpcErrorSchema = z.object({
  data: z.object({ code: z.string() }).optional(),
});

/** Only failures that carry no refusal from the server deserve another request. */
export function shouldRetryQuery(error: unknown): boolean {
  const parsed = trpcErrorSchema.safeParse(error);
  return (
    !parsed.success || !nonRetriableQueryCodes.has(parsed.data.data?.code ?? "")
  );
}

/** TanStack's own default retry cap, which a retry function replaces. */
const maxQueryRetries = 3;

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 30 * 1000,
        // TanStack's default is no retry on the server and three on the client;
        // a function here replaces that rule, so both halves are restated.
        retry: (failureCount, error) =>
          !isServer &&
          failureCount < maxQueryRetries &&
          shouldRetryQuery(error),
      },
      dehydrate: {
        serializeData: SuperJSON.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
      hydrate: {
        deserializeData: SuperJSON.deserialize,
      },
    },
  });
