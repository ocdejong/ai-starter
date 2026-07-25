import { useTranslations } from "next-intl";
import Link from "next/link";
import { type ReactNode } from "react";

import { NavLinks } from "~/components/app-shell/nav-links";
import { UserMenu, type ShellUser } from "~/components/app-shell/user-menu";
import { LocaleSwitcher } from "~/components/locale-switcher";
import { ThemeToggle } from "~/components/theme-toggle";
import { dashboardPath, settingsPath } from "~/lib/routes";

/**
 * The chrome every signed-in page sits in.
 *
 * It takes the account it displays as a prop instead of reading the session, so
 * the layout stays the single place a session is required and the shell itself
 * is provable without one.
 */
export function AppShell({
  children,
  user,
}: {
  readonly children: ReactNode;
  readonly user: ShellUser;
}) {
  const t = useTranslations("home");
  const tNav = useTranslations("app.nav");

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <header className="border-border flex flex-wrap items-center gap-4 border-b px-4 py-3">
        <Link className="text-lg font-semibold" href={dashboardPath}>
          {t("title")}
        </Link>
        {/*
         * The group switcher belongs between the brand and the navigation; stage
         * 12 mounts it here, which is why the header is a flex row with the
         * account controls pinned right rather than a fixed three-column grid.
         */}
        <NavLinks
          ariaLabel={tNav("label")}
          items={[
            { href: dashboardPath, label: tNav("dashboard") },
            { href: settingsPath, label: tNav("settings") },
          ]}
        />
        <div className="ml-auto flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
          <UserMenu user={user} />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
