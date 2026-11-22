import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@ai-starter/api/client";
import { useState, type ReactNode } from "react";
import superjson from "superjson";

import { authClient } from "../auth/client";
import { mobileEnv } from "../env";
import { trpcRequestHeaders } from "./headers";

/**
 * `useTRPC()` returns option builders for TanStack Query's own hooks:
 * `useQuery(trpc.announcement.list.queryOptions())`.
 */
const trpcContext = createTRPCContext<AppRouter>();
export const useTRPC = trpcContext.useTRPC;

export function TRPCProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 2,
            staleTime: 30_000,
          },
        },
      }),
  );

  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        loggerLink({
          enabled: (operation) =>
            process.env.NODE_ENV === "development" ||
            (operation.direction === "down" &&
              operation.result instanceof Error),
        }),
        httpBatchLink({
          transformer: superjson,
          url: `${mobileEnv.EXPO_PUBLIC_API_URL}/api/trpc`,
          // Read per request, not once: the cookie changes as the user signs in
          // and out, and a captured value would authorize the wrong session.
          headers: async () => trpcRequestHeaders(await authClient.getCookie()),
          // The platform has no cookie jar to consult, and asking for one would
          // let a stale ambient credential ride along with the explicit header.
          fetch: (url, options) => {
            const { signal, ...rest } = options ?? {};

            // tRPC passes a string today, but its type admits a `Request`,
            // which stringifies to "[object Request]" rather than its URL.
            return fetch(
              typeof url === "object" && "url" in url
                ? url.url
                : url.toString(),
              {
                ...rest,
                credentials: "omit",
                // React Native types `signal` as `AbortSignal | null`, so an
                // explicit `undefined` is rejected; omit the field instead of
                // widening the platform's type.
                ...(signal == null ? {} : { signal }),
              },
            );
          },
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <trpcContext.TRPCProvider
        trpcClient={trpcClient}
        queryClient={queryClient}
      >
        {children}
      </trpcContext.TRPCProvider>
    </QueryClientProvider>
  );
}
