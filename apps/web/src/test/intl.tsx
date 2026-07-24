import { messages, type Locale } from "@ai-starter/i18n";
import { NextIntlClientProvider } from "next-intl";
import { type ReactNode } from "react";

/**
 * Wraps a component under test in the intl provider so `useTranslations` resolves
 * against the real catalogs. Pass `locale="nl"` to assert the Dutch rendering.
 */
export function IntlTestProvider({
  children,
  locale = "en",
}: {
  children: ReactNode;
  locale?: Locale;
}) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      {children}
    </NextIntlClientProvider>
  );
}
