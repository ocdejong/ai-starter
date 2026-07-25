import { auth } from ".";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { signInPath } from "~/lib/routes";

export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);

/**
 * The protected half of the redirect contract the `(auth)` layout opens: a page
 * that needs an account sends a signed-out visitor to sign in rather than
 * rendering an empty shell. Naming the destination once keeps every protected
 * page agreeing on it. Validation happens here, in the layout or procedure that
 * renders the page — never in middleware, which only sees an optimistic cookie.
 */
export async function requireSession() {
  const session = await getSession();
  if (!session) {
    redirect(signInPath);
  }
  return session;
}
