import { useRouter, useSegments } from "expo-router";
import { useEffect, type ReactNode } from "react";

import { authClient } from "./client";
import { resolveAuthRedirect } from "./redirect";

/**
 * Keeps the router and the session in agreement.
 *
 * It renders its children unconditionally — the navigator has to be mounted
 * before anything can be navigated — and corrects the route in an effect once
 * the session is known. The Expo client serves a cached session from the device
 * keychain, so a returning user's first frame is already the signed-in route
 * rather than a flash of sign-in.
 *
 * The decision itself lives in `resolveAuthRedirect`, which is pure and tested;
 * this component only supplies the router's facts and acts on the answer.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const segments = useSegments();
  const router = useRouter();

  const target = resolveAuthRedirect({
    pending: isPending,
    segments,
    signedIn: session !== null && session !== undefined,
  });

  useEffect(() => {
    if (target !== null) {
      router.replace(target);
    }
  }, [router, target]);

  return children;
}
