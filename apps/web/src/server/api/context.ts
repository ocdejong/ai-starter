import { createTRPCContext as createSharedTRPCContext } from "@ai-starter/api";
import type { AnnouncementRepository, GroupRepository } from "@ai-starter/api";
import {
  createPrismaAnnouncementRepository,
  createPrismaGroupRepository,
  db,
} from "@ai-starter/db";

import { auth } from "~/server/better-auth";

const groups: GroupRepository = createPrismaGroupRepository(db);
// The port is declared by the API layer and satisfied here, at the one place
// that may know both halves. Nothing above this file names Prisma.
const announcements: AnnouncementRepository =
  createPrismaAnnouncementRepository(db);

export const createTRPCContext = async (options: { headers: Headers }) => {
  // `disableCookieCache` costs a query and buys the *current* active group: a
  // cached session keeps naming the group the user has since switched away
  // from, which would put their next request in the wrong one. It is not what
  // makes the request safe — `groupProcedure` re-derives membership either way
  // — it is what makes it correct.
  const session = await auth.api.getSession({
    headers: options.headers,
    query: { disableCookieCache: true },
  });

  return createSharedTRPCContext({
    announcements,
    groups,
    headers: options.headers,
    session:
      session === null
        ? null
        : {
            activeGroupId: session.session.activeOrganizationId ?? null,
            user: { id: session.user.id },
          },
  });
};
