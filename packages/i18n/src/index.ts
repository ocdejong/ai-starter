import en from "../messages/en.json";
import nl from "../messages/nl.json";

export {
  defaultLocale,
  locales,
  localeSchema,
  negotiateLocale,
  parseLocale,
  type Locale,
} from "./locale";

/** Every catalog, keyed by locale — the one place a provider reads messages from. */
export const messages = { en, nl } as const;

/**
 * The message shape both platforms type against. `en` is the reference catalog;
 * `next-intl`/`use-intl` `AppConfig` augmentation points `Messages` here so an
 * unknown `t()` key is a compile error. The parity test keeps `nl` in step.
 */
export type Messages = typeof en;
