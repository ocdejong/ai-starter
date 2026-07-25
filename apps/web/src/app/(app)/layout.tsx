import { AppShell } from "~/components/app-shell/app-shell";
import { requireSession } from "~/server/better-auth/server";

/**
 * The signed-in half of the application.
 *
 * Requiring the session here rather than in each page is what makes the whole
 * group protected by construction: a page added under `(app)` cannot forget the
 * check. Validation happens in this layout because middleware only ever sees the
 * optimistic session cookie.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user } = await requireSession();

  return (
    <AppShell user={{ email: user.email, name: user.name }}>
      {children}
    </AppShell>
  );
}
