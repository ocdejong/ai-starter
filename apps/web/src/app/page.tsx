import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { LatestPost } from "~/app/_components/post";
import { Button } from "~/components/ui/button";
import { auth, primarySocialProvider } from "~/server/better-auth";
import { getSession } from "~/server/better-auth/server";
import { api, HydrateClient } from "~/trpc/server";

export default async function Home() {
  const hello = await api.post.hello({ text: "from tRPC" });
  const session = await getSession();
  const socialProvider = primarySocialProvider;

  if (session) {
    void api.post.getLatest.prefetch();
  }

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
            AI Starter
          </h1>
          <div className="flex flex-col items-center gap-2">
            <p className="text-2xl text-white">
              {hello ? hello.greeting : "Loading tRPC query..."}
            </p>

            <div className="flex flex-col items-center justify-center gap-4">
              <p className="text-center text-2xl text-white">
                {session && <span>Logged in as {session.user?.name}</span>}
              </p>
              {!session && socialProvider ? (
                <form>
                  <Button
                    className="rounded-full bg-white/10 px-10 py-3 hover:bg-white/20"
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
                    Sign in with {socialProvider}
                  </Button>
                </form>
              ) : session ? (
                <form>
                  <Button
                    className="rounded-full bg-white/10 px-10 py-3 hover:bg-white/20"
                    formAction={async () => {
                      "use server";
                      await auth.api.signOut({
                        headers: await headers(),
                      });
                      redirect("/");
                    }}
                  >
                    Sign out
                  </Button>
                </form>
              ) : (
                <p className="text-sm text-white/70">
                  Add Google or GitHub OAuth credentials to enable sign-in.
                </p>
              )}
            </div>
          </div>

          {session?.user && <LatestPost />}
        </div>
      </main>
    </HydrateClient>
  );
}
