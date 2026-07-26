"use client";

import { useTranslations } from "next-intl";

import {
  AnnouncementPanel,
  type AnnouncementFailure,
} from "~/components/announcements/announcement-panel";
import { api } from "~/trpc/react";

/**
 * A request that never reached the server carries no error payload; anything
 * else was refused by one. Those are the only two states a reader can act on
 * differently, so the interface does not invent more.
 */
export function announcementFailure(
  error: { readonly data?: unknown } | null,
): AnnouncementFailure | null {
  if (error === null) {
    return null;
  }
  return error.data === null || error.data === undefined
    ? "network"
    : "unexpected";
}

/**
 * Wires the announcements screen to the API.
 *
 * Nothing here names a group. `groupProcedure` resolves it from the verified
 * membership behind the request, so switching groups changes what this screen
 * shows without the client ever being trusted to ask for the right one.
 */
export function AnnouncementBoard() {
  const t = useTranslations("app.announcements");
  const utils = api.useUtils();
  const announcements = api.announcement.list.useQuery();

  const publish = api.announcement.publish.useMutation({
    onSuccess: async () => {
      await utils.announcement.list.invalidate();
    },
  });
  const rename = api.announcement.rename.useMutation({
    onSuccess: async () => {
      await utils.announcement.list.invalidate();
    },
  });

  if (announcements.isPending) {
    return <p className="text-muted-foreground">{t("loading")}</p>;
  }

  if (announcements.data === undefined) {
    return (
      <p
        className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm"
        role="alert"
      >
        {t(
          `errors.${announcementFailure(announcements.error) ?? "unexpected"}`,
        )}
      </p>
    );
  }

  return (
    <AnnouncementPanel
      announcements={announcements.data}
      failure={
        announcementFailure(publish.error) ?? announcementFailure(rename.error)
      }
      isPublishing={publish.isPending}
      isRenaming={rename.isPending}
      onPublish={(title) => {
        publish.mutate({ title });
      }}
      onRename={(input) => {
        rename.mutate(input);
      }}
      renameSaved={rename.isSuccess}
    />
  );
}
