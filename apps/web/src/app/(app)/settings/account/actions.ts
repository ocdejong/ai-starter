"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { accountSettingsPath } from "~/lib/routes";
import { auth } from "~/server/better-auth";
import { revalidatePath } from "next/cache";

/**
 * Session revocation, kept on the server because the handle it needs must stay
 * there.
 *
 * Better Auth revokes by session *token*, and a token is a bearer credential:
 * handing the page every device's token so the browser could call the endpoint
 * itself would undo the point of an `httpOnly` cookie. The page therefore knows
 * only ids, and this action resolves an id back to a token against the caller's
 * own session list — which is also what makes another account's id useless here,
 * since it simply will not be in that list.
 */
const sessionIdSchema = z.string().min(1);

export async function revokeSessionAction(sessionId: unknown): Promise<void> {
  const id = sessionIdSchema.parse(sessionId);
  const requestHeaders = await headers();
  const sessions = await auth.api.listSessions({ headers: requestHeaders });
  const target = sessions.find((session) => session.id === id);

  if (target === undefined) {
    throw new Error("No such session for this account.");
  }

  await auth.api.revokeSession({
    body: { token: target.token },
    headers: requestHeaders,
  });
  revalidatePath(accountSettingsPath);
}

export async function revokeOtherSessionsAction(): Promise<void> {
  await auth.api.revokeOtherSessions({ headers: await headers() });
  revalidatePath(accountSettingsPath);
}
