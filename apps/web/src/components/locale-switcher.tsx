"use client";

import { locales, type Locale } from "@ai-starter/i18n";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "~/components/ui/button";
import { setLocale } from "~/i18n/set-locale";

/** The locale label key that names each language in its own tongue. */
const labelKeys = { en: "english", nl: "dutch" } as const satisfies Record<
  Locale,
  "english" | "dutch"
>;

/**
 * Switches the active language. Persisting the choice is a server action that
 * writes the cookie the request config reads; `router.refresh()` then re-renders
 * the server tree in the new locale without a full reload.
 */
export function LocaleSwitcher() {
  const t = useTranslations("locale");
  const active = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function choose(locale: Locale) {
    startTransition(async () => {
      await setLocale(locale);
      router.refresh();
    });
  }

  return (
    <div
      role="group"
      aria-label={t("label")}
      className="border-border bg-card inline-flex gap-1 rounded-lg border p-1"
    >
      {locales.map((locale) => {
        const selected = locale === active;

        return (
          <Button
            key={locale}
            type="button"
            size="sm"
            variant={selected ? "default" : "ghost"}
            aria-pressed={selected}
            disabled={isPending}
            onClick={() => {
              choose(locale);
            }}
          >
            {t(labelKeys[locale])}
          </Button>
        );
      })}
    </div>
  );
}
