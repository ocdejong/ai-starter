import { getTranslations } from "next-intl/server";

import { AnnouncementBoard } from "~/components/announcements/announcement-board";

/**
 * The example feature slice, on the page a generated feature lands on.
 *
 * It sits inside the `(app)` group, whose layout is the one place a web session
 * is required — so this page never checks for one itself and cannot forget to.
 */
export default async function AnnouncementsPage() {
  const t = await getTranslations("app.announcements");

  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </header>
      <AnnouncementBoard />
    </>
  );
}
