import { messages, type Locale } from "@ai-starter/i18n";
import { type ReactNode } from "react";
import { IntlProvider } from "use-intl";

import { ThemeProvider } from "../theme/theme-provider";

/**
 * Wraps a native component under test in the theme and intl providers it now
 * depends on. Pass `locale="nl"` to assert the Dutch rendering. This mirrors the
 * runtime tree (`ThemeProvider` outermost) minus the tRPC transport.
 */
export function TestProviders({
  children,
  locale = "en",
}: {
  children: ReactNode;
  locale?: Locale;
}) {
  return (
    <ThemeProvider>
      <IntlProvider locale={locale} messages={messages[locale]}>
        {children}
      </IntlProvider>
    </ThemeProvider>
  );
}
