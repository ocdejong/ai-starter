import { getTranslations } from "next-intl/server";

import { Chat } from "~/app/_components/chat";
import { isChatConfigured } from "~/server/ai";

export default async function DashboardPage() {
  const t = await getTranslations("app.dashboard");

  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </header>
      {/*
       * The group layout requires a session before this renders, so the chat is
       * signed in by construction; what it still cannot assume is a provider key.
       */}
      <Chat isConfigured={isChatConfigured()} isSignedIn />
    </>
  );
}
