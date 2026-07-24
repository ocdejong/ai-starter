import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Chat } from "~/app/_components/chat";
import { LatestPost } from "~/app/_components/post";
import { LocaleSwitcher } from "~/components/locale-switcher";
import { ThemeToggle } from "~/components/theme-toggle";
import { Button } from "~/components/ui/button";
import { isChatConfigured } from "~/server/ai";
import { auth, primarySocialProvider } from "~/server/better-auth";
import { getSession } from "~/server/better-auth/server";
import { api, HydrateClient } from "~/trpc/server";

export default async function Home() {
  const t = await getTranslations("home");
  const hello = await api.post.hello({ text: "from tRPC" });
  const session = await getSession();
  const socialProvider = primarySocialProvider;

  if (session) {
    void api.post.getLatest.prefetch();
  }

  return (
    <HydrateClient>
      <main className="bg-background text-foreground relative flex min-h-screen flex-col items-center justify-center">
        <div className="absolute right-4 top-4 flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
            {t("title")}
          </h1>
          <div className="flex flex-col items-center gap-2">
            <p className="text-2xl">
              {hello ? hello.greeting : t("greetingFallback")}
            </p>

            <div className="flex flex-col items-center justify-center gap-4">
              <p className="text-center text-2xl">
                {session && (
                  <span>
                    {t("loggedInAs", { name: session.user?.name ?? "" })}
                  </span>
                )}
              </p>
              {!session && socialProvider ? (
                <form>
                  <Button
                    className="rounded-full px-10 py-3"
                    formAction={async () => {
                      "use server";
                      const res = await auth.api.signInSocial({
                        body: {
                          provider: socialProvider,
                          callbackURL: "/",
                        },
                      });
                      if (!res.url) {
                        throw new Error("No URL returned from signInSocial");
                      }
                      redirect(res.url);
                    }}
                  >
                    {t("signInWith", { provider: socialProvider })}
                  </Button>
                </form>
              ) : session ? (
                <form>
                  <Button
                    className="rounded-full px-10 py-3"
                    formAction={async () => {
                      "use server";
                      await auth.api.signOut({
                        headers: await headers(),
                      });
                      redirect("/");
                    }}
                  >
                    {t("signOut")}
                  </Button>
                </form>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {t("oauthHint")}
                </p>
              )}
            </div>
          </div>

          <Chat
            isConfigured={isChatConfigured()}
            isSignedIn={session !== null}
          />

          {session?.user && <LatestPost />}
        </div>
      </main>
    </HydrateClient>
  );
}
