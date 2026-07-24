"use server";

import { localeSchema } from "@ai-starter/i18n";
import { cookies } from "next/headers";

import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "./locale-cookie";

/**
 * Persists the visitor's language choice. The value arrives from the client, so
 * it is parsed here before it reaches the cookie; the request config re-parses
 * it on the way back out. The switcher calls `router.refresh()` afterwards so the
 * server tree re-renders with the new locale.
 */
export async function setLocale(locale: unknown): Promise<void> {
  const parsed = localeSchema.parse(locale);
  (await cookies()).set(LOCALE_COOKIE, parsed, {
    httpOnly: true,
    maxAge: LOCALE_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
  });
}
