/**
 * Hermes ships no `Intl.PluralRules`, so ICU plural messages crash without a
 * polyfill. FormatJS must be applied in dependency order — canonical locales,
 * then `Intl.Locale`, then `Intl.PluralRules` — and the plural rules need their
 * per-locale data loaded explicitly. This module is imported first in the root
 * layout so the runtime is patched before any component formats a message.
 *
 * The `-force` variants install unconditionally rather than feature-detecting;
 * that keeps behaviour identical across Hermes versions and the JSC fallback.
 * Add a locale-data import here whenever a locale is added to the catalogs.
 */
import "@formatjs/intl-getcanonicallocales/polyfill-force.js";
import "@formatjs/intl-locale/polyfill-force.js";
import "@formatjs/intl-pluralrules/polyfill-force.js";
import "@formatjs/intl-pluralrules/locale-data/en.js";
import "@formatjs/intl-pluralrules/locale-data/nl.js";
