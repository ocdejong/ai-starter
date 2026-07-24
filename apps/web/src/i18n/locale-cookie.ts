/**
 * The cookie the locale switcher writes and the request config reads. No
 * `[locale]` segment routes this app — it lives behind auth, so the chosen
 * language travels in a cookie and the URLs stay clean. A downstream product
 * that needs localized SEO URLs can layer next-intl's routed setup on top.
 */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** A year: long enough that a returning visitor keeps their choice. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
