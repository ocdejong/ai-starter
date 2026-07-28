import { redirect } from "next/navigation";

import { LocaleSwitcher } from "~/components/locale-switcher";
import { ThemeToggle } from "~/components/theme-toggle";
import { dashboardPath } from "~/lib/routes";
import { getSession } from "~/server/better-auth/server";

/**
 * The shell every visitor-facing auth page shares. It also owns one half of the
 * redirect contract: a signed-in visitor has no business on a sign-in page, and
 * this is what makes a confirmation link land on the application rather than on
 * a form the visitor no longer needs. The other half is `requireSession`.
 *
 * The destination is the dashboard rather than the landing page: a visitor who
 * just proved they have an account wants the application, not its sales pitch.
 */
export default async function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (await getSession()) {
    redirect(dashboardPath);
  }

  return (
    <main className="bg-background text-foreground relative flex min-h-screen flex-col items-center justify-center p-4">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>
      <div className="bg-card text-card-foreground border-border w-full max-w-sm rounded-xl border p-6 shadow-sm">
        {children}
      </div>
    </main>
  );
}
