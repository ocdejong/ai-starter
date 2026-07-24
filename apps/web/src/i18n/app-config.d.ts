import type { Locale, Messages } from "@ai-starter/i18n";

/**
 * Binds next-intl's key types to this product's catalogs, so `t("home.title")`
 * is checked and `t("home.nope")` is a compile error. `Messages` is `typeof en`
 * from the shared package; the catalog-parity test keeps every locale in step.
 * The `app-config.assert.ts` guard proves this augmentation is actually in force.
 */
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}
