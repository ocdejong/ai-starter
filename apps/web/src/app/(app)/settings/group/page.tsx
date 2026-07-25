import { getTranslations } from "next-intl/server";

import { GroupSettings } from "~/components/groups/group-settings";

export default async function GroupSettingsPage() {
  const t = await getTranslations("app.settings");

  return (
    <section aria-labelledby="group-settings" className="space-y-6">
      <h2 className="text-xl font-semibold" id="group-settings">
        {t("group")}
      </h2>
      <GroupSettings />
    </section>
  );
}
