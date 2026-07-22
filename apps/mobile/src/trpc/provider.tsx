import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@ai-starter/api/client";
import { useState, type ReactNode } from "react";
import superjson from "superjson";

import { mobileEnv } from "../env";

export const api = createTRPCReact<AppRouter>();

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
    api.createClient({
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
          headers: {
            "x-trpc-source": "expo-react-native",
          },
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        {children}
      </api.Provider>
    </QueryClientProvider>
  );
}
