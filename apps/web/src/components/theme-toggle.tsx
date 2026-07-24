"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";

import { Button } from "~/components/ui/button";

const noop = () => () => {
  // No external store to subscribe to; the snapshots alone drive the value.
};

/** True only after hydration, so server and first client render agree. */
function useMounted(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

const options = [
  { Icon: Sun, value: "light" },
  { Icon: Moon, value: "dark" },
  { Icon: Monitor, value: "system" },
] as const;

/**
 * Three-way theme control: light, dark, or follow the system.
 *
 * The active option is only known after mount — on the server the chosen theme
 * is unknown — so the pressed state is gated on a mount flag to avoid a
 * hydration mismatch. The buttons themselves render on the server so the
 * control never shifts layout.
 */
export function ThemeToggle() {
  const t = useTranslations("theme");
  const { setTheme, theme } = useTheme();
  const mounted = useMounted();

  return (
    <div
      role="group"
      aria-label={t("label")}
      className="border-border bg-card inline-flex gap-1 rounded-lg border p-1"
    >
      {options.map(({ Icon, value }) => {
        const active = mounted && theme === value;

        return (
          <Button
            key={value}
            type="button"
            size="icon"
            variant={active ? "default" : "ghost"}
            aria-label={t(value)}
            aria-pressed={active}
            onClick={() => {
              setTheme(value);
            }}
          >
            <Icon aria-hidden />
          </Button>
        );
      })}
    </div>
  );
}
