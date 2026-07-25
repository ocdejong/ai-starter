import { getTranslations } from "next-intl/server";

export default async function GroupSettingsPage() {
  const t = await getTranslations("app.settings");

  return (
    <section aria-labelledby="group-settings">
      <h2 className="text-xl font-semibold" id="group-settings">
        {t("group")}
      </h2>
      <p className="text-muted-foreground mt-2 text-sm">{t("groupEmpty")}</p>
    </section>
  );
}
