import type { Database } from "@ai-starter/db";
import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";

import { personalGroupOwnerId } from "./personal-group";

const refusal = {
  code: "PERSONAL_GROUP_REQUIRED",
  message: "A personal group cannot be removed or renamed.",
} as const;

/**
 * What each guarded endpoint protects. Deleting or renaming a personal group is
 * refused for everyone, because anyone invited into it could otherwise take it
 * from the person it belongs to; leaving is refused only for that person, since
 * an invitee leaving takes nothing from them.
 */
const guardedPaths: Readonly<Record<string, "owner-only" | "anyone">> = {
  "/organization/delete": "anyone",
  "/organization/leave": "owner-only",
  "/organization/update": "anyone",
};

// Both values below arrive untyped — a request body and the session's
// active-group id, which Better Auth types as `any` — and this is the one place
// that reads them, so they are narrowed here rather than in the handler. The
// group id is optional in the body because Better Auth's update endpoint falls
// back to the session's active group, and the settings screen relies on that.
function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function requestedGroupId(body: unknown): string | undefined {
  return typeof body === "object" && body !== null && "organizationId" in body
    ? nonEmptyString(body.organizationId)
    : undefined;
}

/**
 * Keeps every account's personal group an invariant of the auth API itself.
 *
 * The organization plugin has no single place to say "this group stays", and
 * the interface withholding the controls protects nobody who calls the
 * endpoints directly — an older client, a script, a replayed request. Renaming
 * is guarded together with the other two because the personal group is
 * recognised by its slug: a group that can be renamed can stop being personal
 * and then be deleted.
 */
export function personalGroupProtection(database: Database): BetterAuthPlugin {
  return {
    hooks: {
      before: [
        {
          matcher: (context) =>
            context.path !== undefined && context.path in guardedPaths,
          handler: createAuthMiddleware(async (context) => {
            const guard = guardedPaths[context.path ?? ""];
            if (guard === undefined) {
              return;
            }

            const session = await getSessionFromCtx(context);
            if (session === null) {
              return;
            }

            const groupId =
              requestedGroupId(context.body) ??
              nonEmptyString(session.session.activeOrganizationId);
            if (groupId === undefined) {
              return;
            }

            const ownerId = await personalGroupOwnerId(database, groupId);
            if (
              ownerId !== null &&
              (guard === "anyone" || ownerId === session.user.id)
            ) {
              throw new APIError("BAD_REQUEST", refusal);
            }
          }),
        },
      ],
    },
    id: "personal-group-protection",
  };
}
