import { getTranslations } from "next-intl/server";

export default async function AccountSettingsPage() {
  const t = await getTranslations("app.settings");

  return (
    <section aria-labelledby="account-settings">
      <h2 className="text-xl font-semibold" id="account-settings">
        {t("account")}
      </h2>
      <p className="text-muted-foreground mt-2 text-sm">{t("accountEmpty")}</p>
    </section>
  );
}
