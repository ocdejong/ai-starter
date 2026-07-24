"use client";

import type { ComponentProps } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Wraps next-themes so the app has one place to own theming behaviour.
 *
 * The concrete configuration (class attribute, system default) is passed by the
 * root layout, which is the composition root. The provider's blocking head
 * script is what prevents a wrong-theme flash before hydration.
 */
export function ThemeProvider(
  props: ComponentProps<typeof NextThemesProvider>,
) {
  return <NextThemesProvider {...props} />;
}
