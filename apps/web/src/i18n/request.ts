import {
  messages,
  negotiateLocale,
  parseLocale,
  type Locale,
} from "@ai-starter/i18n";
import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { LOCALE_COOKIE } from "./locale-cookie";

/**
 * Resolves the request locale with the precedence the product wants: an explicit
 * cookie the visitor set, otherwise the language their browser negotiated, and
 * `en` as the floor. Both the cookie and the header are untrusted input, so each
 * is parsed before it is trusted.
 */
async function resolveLocale(): Promise<Locale> {
  const cookieLocale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  if (cookieLocale !== null) {
    return cookieLocale;
  }
  return negotiateLocale((await headers()).get("accept-language"));
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return { locale, messages: messages[locale] };
});
