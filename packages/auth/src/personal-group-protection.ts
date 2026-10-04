import type { Database } from "@ai-starter/db";
import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";

import { groupOwnerRole, personalGroupOwnerId } from "./personal-group";

// The message is for whoever reads a log or a raw response; no client displays
// it. Web and mobile both read only `code`, and `groupErrorFor` in
// `@ai-starter/domain` turns this one into catalog copy (`personalGroup`).
// Change the code in both places together.
const refusal = {
  code: "PERSONAL_GROUP_REQUIRED",
  message: "A personal group cannot be removed or renamed.",
} as const;

/**
 * What each guarded endpoint protects. Deleting or renaming a personal group is
 * refused for everyone, because anyone invited into it could otherwise take it
 * from the person it belongs to; leaving is refused only for that person, since
 * an invitee leaving takes nothing from them. Removing a member and changing a
 * member's role are refused only when they name the owner: an invitee promoted
 * to owner would otherwise be able to remove or demote the person the group is
 * recognised by, after which it is an ordinary group.
 */
const guardedPaths: Readonly<
  Record<string, "owner-only" | "anyone" | "owner-as-target">
> = {
  "/organization/delete": "anyone",
  "/organization/leave": "owner-only",
  "/organization/remove-member": "owner-as-target",
  "/organization/update": "anyone",
  "/organization/update-member-role": "owner-as-target",
};

// Both values below arrive untyped — a request body and the session's
// active-group id, which Better Auth types as `any` — and this is the one place
// that reads them, so they are narrowed here rather than in the handler. The
// group id is optional in the body because Better Auth's update endpoint falls
// back to the session's active group, and the settings screen relies on that.
function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function memberId(body: unknown): string | undefined {
  return typeof body === "object" && body !== null && "memberId" in body
    ? nonEmptyString(body.memberId)
    : undefined;
}

function memberIdOrEmail(body: unknown): string | undefined {
  return typeof body === "object" && body !== null && "memberIdOrEmail" in body
    ? nonEmptyString(body.memberIdOrEmail)
    : undefined;
}

function requestedRole(body: unknown): unknown {
  return typeof body === "object" && body !== null && "role" in body
    ? body.role
    : undefined;
}

function requestedGroupId(body: unknown): string | undefined {
  return typeof body === "object" && body !== null && "organizationId" in body
    ? nonEmptyString(body.organizationId)
    : undefined;
}

/**
 * Whether the request names the owner as the member it acts on. The two
 * endpoints name their target differently: `remove-member` by member id or by
 * address (Better Auth lower-cases the address before looking it up), and
 * `update-member-role` by member id, where only a role set without the owner
 * role takes it away.
 */
async function namesOwner(
  database: Database,
  path: string,
  body: unknown,
  groupId: string,
  ownerId: string,
): Promise<boolean> {
  const removing = path === "/organization/remove-member";
  const target = removing ? memberIdOrEmail(body) : memberId(body);
  if (target === undefined) {
    return false;
  }

  if (
    path === "/organization/update-member-role" &&
    keepsOwnerRole(requestedRole(body))
  ) {
    return false;
  }

  const owner = await database.member.findFirst({
    select: { id: true, user: { select: { email: true } } },
    where: { organizationId: groupId, userId: ownerId },
  });
  return (
    owner !== null &&
    (target === owner.id ||
      (removing && target.toLowerCase() === owner.user.email.toLowerCase()))
  );
}

/** Better Auth accepts a role as a string, a comma list, or an array of either. */
function keepsOwnerRole(role: unknown): boolean {
  const roles = Array.isArray(role) ? role : [role];
  return roles.some(
    (entry) =>
      typeof entry === "string" &&
      entry.split(",").some((name) => name.trim() === groupOwnerRole),
  );
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
            if (ownerId === null) {
              return;
            }

            const refused =
              guard === "anyone" ||
              (guard === "owner-only" && ownerId === session.user.id) ||
              (guard === "owner-as-target" &&
                (await namesOwner(
                  database,
                  context.path ?? "",
                  context.body,
                  groupId,
                  ownerId,
                )));
            if (refused) {
              throw new APIError("BAD_REQUEST", refusal);
            }
          }),
        },
      ],
    },
    id: "personal-group-protection",
  };
}
