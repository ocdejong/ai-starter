import { render, screen } from "@testing-library/react";
import { useTranslations } from "next-intl";
import { ThemeProvider } from "next-themes";
import { describe, expect, it } from "vitest";

import { ThemeToggle } from "~/components/theme-toggle";
import { IntlTestProvider } from "~/test/intl";

/**
 * Compile-time guard that the next-intl `AppConfig` augmentation is in force, so
 * a wrong `t()` key is a type error rather than a runtime surprise. Exported but
 * never rendered: if the augmentation stops taking effect, message keys widen to
 * `string`, `t("nope")` stops erroring, and the now-unused `@ts-expect-error`
 * turns `pnpm typecheck` red. Verified by toggling the augmentation off.
 */
export function TypedKeyProbe() {
  const t = useTranslations("home");
  t("title");
  // @ts-expect-error "nope" is not a key in the home namespace
  t("nope");
  return null;
}

describe("Dutch rendering", () => {
  it("renders a real control against the Dutch catalog", () => {
    render(
      <IntlTestProvider locale="nl">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ThemeToggle />
        </ThemeProvider>
      </IntlTestProvider>,
    );

    expect(screen.getByRole("group", { name: "Thema" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Donker" })).toBeInTheDocument();
  });
});
