import type { Locale, Messages } from "@ai-starter/i18n";

/**
 * Binds use-intl's key types to this product's catalogs on native, so
 * `t("mobile.homeTitle")` is checked and an unknown key is a compile error.
 * The mobile app talks to use-intl directly (next-intl is web-only); `AppConfig`
 * is declared in use-intl, so that is the module augmented here.
 */
declare module "use-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}
