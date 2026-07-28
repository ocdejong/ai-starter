import { useTranslations } from "use-intl";

import { api } from "../../trpc/provider";
import { Notice } from "../auth/notice";
import {
  AnnouncementPanel,
  type AnnouncementFailure,
} from "./announcement-panel";

/**
 * A request that never reached the server carries no error payload; anything
 * else was refused by one. Those are the only two states a reader can act on
 * differently, so the interface does not invent more.
 *
 * Unexported, unlike its web twin: a native test cannot import this module at
 * all, because the tRPC provider it reaches leads to a Better Auth client that
 * jest-expo cannot load. Widening the surface for a test that cannot use it is
 * how a module ends up with an export nothing reaches.
 */
function announcementFailure(
  error: { data?: unknown } | null,
): AnnouncementFailure | null {
  if (error === null) {
    return null;
  }
  return error.data === null || error.data === undefined
    ? "network"
    : "unexpected";
}

/**
 * Wires the announcements tab to the API.
 *
 * Nothing here names a group. `groupProcedure` resolves it from the verified
 * membership behind the request, so the same screen shows another group's
 * announcements after a switch without the client asking for one.
 */
export function AnnouncementBoard() {
  const t = useTranslations("app.announcements");
  const utils = api.useUtils();
  const announcements = api.announcement.list.useQuery();

  const create = api.announcement.create.useMutation({
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
    return <Notice message={t("loading")} tone="info" />;
  }

  if (announcements.data === undefined) {
    return (
      <Notice
        message={t(
          `errors.${announcementFailure(announcements.error) ?? "unexpected"}`,
        )}
        tone="error"
      />
    );
  }

  return (
    <AnnouncementPanel
      announcements={announcements.data}
      failure={
        announcementFailure(create.error) ?? announcementFailure(rename.error)
      }
      isCreating={create.isPending}
      isRenaming={rename.isPending}
      onCreate={(title) => {
        create.mutate({ title });
      }}
      onRename={(input) => {
        rename.mutate(input);
      }}
      renameSaved={rename.isSuccess}
    />
  );
}
