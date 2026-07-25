"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = {
  readonly href: string;
  /** Already translated: the caller owns which namespace the label comes from. */
  readonly label: string;
};

/**
 * A set of links that knows which one the visitor is looking at.
 *
 * This is the only part of the navigation that has to run on the client — the
 * active section is derived from the current path — so both the shell's own
 * navigation and the settings sections resolve their labels on the server and
 * hand them here.
 */
export function NavLinks({
  ariaLabel,
  items,
  orientation = "horizontal",
}: {
  readonly ariaLabel: string;
  readonly items: readonly NavItem[];
  readonly orientation?: "horizontal" | "vertical";
}) {
  const pathname = usePathname();

  return (
    <nav aria-label={ariaLabel}>
      <ul
        className={
          orientation === "vertical"
            ? "flex min-w-40 flex-col gap-1"
            : "flex items-center gap-1"
        }
      >
        {items.map(({ href, label }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={href}>
              <Link
                aria-current={active ? "page" : undefined}
                className={`block rounded-md px-3 py-2 text-sm font-medium ${
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                href={href}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
