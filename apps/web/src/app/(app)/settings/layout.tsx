import { getTranslations } from "next-intl/server";

import { NavLinks } from "~/components/app-shell/nav-links";
import { accountSettingsPath, groupSettingsPath } from "~/lib/routes";

/**
 * The settings shell: a heading and the section list, around whichever section
 * the visitor opened. The sections live in their own routes so the account and
 * group screens can be built independently of one another.
 */
export default async function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const t = await getTranslations("app.settings");

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <div className="flex flex-col gap-8 sm:flex-row">
        <NavLinks
          ariaLabel={t("sectionsLabel")}
          items={[
            { href: accountSettingsPath, label: t("account") },
            { href: groupSettingsPath, label: t("group") },
          ]}
          orientation="vertical"
        />
        <div className="flex flex-1 flex-col gap-6">{children}</div>
      </div>
    </>
  );
}
