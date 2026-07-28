import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Chat } from "~/app/_components/chat";
import { SocialSignIn } from "~/app/_components/social-sign-in";
import { LocaleSwitcher } from "~/components/locale-switcher";
import { ThemeToggle } from "~/components/theme-toggle";
import { Button } from "~/components/ui/button";
import { dashboardPath } from "~/lib/routes";
import { isChatConfigured } from "~/server/ai";
import { auth, primarySocialProvider } from "~/server/better-auth";
import { getSession } from "~/server/better-auth/server";

/**
 * The landing page: what this repository is, and the two ways in.
 *
 * It stays reachable while signed in — a visitor who follows a bookmark should
 * see where they are rather than be bounced — so it names the account and points
 * at the dashboard instead of duplicating the application's own chrome.
 */
export default async function Home() {
  const t = await getTranslations("home");
  const session = await getSession();
  const socialProvider = primarySocialProvider;

  return (
    <main className="bg-background text-foreground relative flex min-h-screen flex-col items-center justify-center">
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>
      <div className="container flex max-w-3xl flex-col items-center justify-center gap-12 px-4 py-16">
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
            {t("title")}
          </h1>
          <p className="text-2xl">{t("tagline")}</p>
          <p className="text-muted-foreground max-w-xl">{t("description")}</p>
        </div>

        {/*
         * The ways in are a navigation landmark, not a loose pair of links: the
         * chat below offers its own "Sign in" gate, and naming this region is
         * what keeps "the way in" addressable — for a screen reader reaching for
         * the primary action, and for the journey that asserts on it.
         */}
        <nav
          aria-label={t("ctaLabel")}
          className="flex flex-col items-center gap-4"
        >
          {session ? (
            <>
              <p className="text-lg">
                {t("loggedInAs", { name: session.user.name })}
              </p>
              <Button asChild className="rounded-full px-10 py-3">
                <Link href={dashboardPath}>{t("openDashboard")}</Link>
              </Button>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button asChild className="rounded-full px-10 py-3">
                  <Link href="/sign-up">{t("signUp")}</Link>
                </Button>
                <Button
                  asChild
                  className="rounded-full px-10 py-3"
                  variant="secondary"
                >
                  <Link href="/sign-in">{t("signIn")}</Link>
                </Button>
              </div>
              <SocialSignIn
                provider={socialProvider}
                signIn={async () => {
                  "use server";
                  if (socialProvider === null) {
                    return;
                  }
                  const res = await auth.api.signInSocial({
                    body: {
                      provider: socialProvider,
                      callbackURL: dashboardPath,
                    },
                  });
                  if (!res.url) {
                    throw new Error("No URL returned from signInSocial");
                  }
                  redirect(res.url);
                }}
              />
            </>
          )}
        </nav>

        {/* The chat is the starter's example feature; the dashboard hosts the
            signed-in copy of it, and here it doubles as the demo. */}
        <Chat isConfigured={isChatConfigured()} isSignedIn={session !== null} />
      </div>
    </main>
  );
}
