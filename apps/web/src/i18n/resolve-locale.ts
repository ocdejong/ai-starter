import { negotiateLocale, parseLocale, type Locale } from "@ai-starter/i18n";

/**
 * The precedence this product wants: an explicit cookie the visitor set, then
 * the language their browser negotiated, with `en` as the floor.
 *
 * Pure, and separate from the request config for the reason `negotiateLocale`
 * itself is pure — the caller supplies the two strings it read from the request,
 * so the chain can be proven without a request. Both are untrusted input and
 * each is parsed before it is trusted: a cookie is as forgeable as a header.
 */
export function resolveLocale(
  cookieValue: string | undefined,
  acceptLanguage: string | null,
): Locale {
  return parseLocale(cookieValue) ?? negotiateLocale(acceptLanguage);
}
