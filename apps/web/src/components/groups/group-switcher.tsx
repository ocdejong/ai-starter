"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Select } from "~/components/ui/select";
import { authClient } from "~/server/better-auth/client";

/**
 * Chooses which group the application is working in.
 *
 * The choice lives in the session, not in this component: `setActive` writes it
 * server-side and `router.refresh()` asks the server components to render again
 * against the group they now resolve. Nothing here decides what the new group
 * may show — every procedure re-derives the membership behind that id on the
 * next request.
 */
export function GroupSwitcher() {
  const t = useTranslations("app.settings.groups");
  const router = useRouter();
  const { data: groups } = authClient.useListOrganizations();
  const { data: activeGroup } = authClient.useActiveOrganization();
  const [isSwitching, setIsSwitching] = useState(false);

  // An account with no group has nothing to switch between; the settings page
  // is where it is offered a first one.
  if (groups === null || groups === undefined || groups.length === 0) {
    return null;
  }

  return (
    <div>
      <label className="sr-only" htmlFor="group-switcher">
        {t("switcherLabel")}
      </label>
      <Select
        className="w-auto"
        disabled={isSwitching}
        id="group-switcher"
        onChange={(event) => {
          const organizationId = event.target.value;
          setIsSwitching(true);
          void (async () => {
            try {
              await authClient.organization.setActive({ organizationId });
              router.refresh();
            } finally {
              setIsSwitching(false);
            }
          })();
        }}
        value={activeGroup?.id ?? ""}
      >
        {activeGroup === null || activeGroup === undefined ? (
          <option value="">{t("switcherLabel")}</option>
        ) : null}
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
