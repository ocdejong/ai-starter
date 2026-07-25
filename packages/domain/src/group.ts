import { z } from "zod";

/**
 * The roles a group membership can carry, most privileged first.
 *
 * They are the auth server's own role names, which is what lets a stored role
 * be shown, offered and submitted without a translation table in between. What
 * each role may *do* is decided by the server on every request; this list only
 * says which names exist.
 */
export const groupRoles = ["owner", "admin", "member"] as const;

export type GroupRole = (typeof groupRoles)[number];

export const groupRoleSchema = z.enum(groupRoles);

/**
 * Narrows a role that arrived from the server. Better Auth stores roles as a
 * comma-separated string and this application never assigns more than one, so a
 * value it does not recognise is rendered as unknown rather than guessed at.
 */
export function parseGroupRole(value: unknown): GroupRole | null {
  const result = groupRoleSchema.safeParse(value);
  return result.success ? result.data : null;
}

/** The bounds a group name has to satisfy, shared by web and native. */
export const groupNamePolicy = { maxLength: 100 } as const;

/**
 * Every validation failure the group schemas can report, as stable codes rather
 * than prose — the same contract the auth schemas use, because these schemas are
 * equally unable to reach a message catalog. Each code is a key under
 * `app.settings.groups.validation`.
 */
export const groupValidationCodes = [
  "emailInvalid",
  "groupNameRequired",
  "groupNameTooLong",
] as const;

export type GroupValidationCode = (typeof groupValidationCodes)[number];

const groupValidationCodeSchema = z.enum(groupValidationCodes);

/** Narrows a form-library message back to a code a catalog can translate. */
export function parseGroupValidationCode(
  value: unknown,
): GroupValidationCode | null {
  const result = groupValidationCodeSchema.safeParse(value);
  return result.success ? result.data : null;
}

const groupNameSchema = z
  .string()
  .trim()
  .min(1, { error: "groupNameRequired" })
  .max(groupNamePolicy.maxLength, { error: "groupNameTooLong" });

/** One account is one identity, so an invited address is always normalised. */
const invitedEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "emailInvalid" }));

export const createGroupInputSchema = z.object({ name: groupNameSchema });

export const renameGroupInputSchema = z.object({ name: groupNameSchema });

export const inviteMemberInputSchema = z.object({
  email: invitedEmailSchema,
  role: groupRoleSchema,
});

export type CreateGroupInput = z.infer<typeof createGroupInputSchema>;
export type RenameGroupInput = z.infer<typeof renameGroupInputSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberInputSchema>;

/**
 * The roles a member holding `actorRole` may hand to someone else.
 *
 * It mirrors the auth server's rule that only an owner may create another owner
 * — the server refuses an admin who tries, both when inviting and when changing
 * a role, and `group-flows.integration.test.ts` pins that refusal. Offering a
 * role the server would reject is a promise the interface cannot keep, so the
 * two lists are kept in step deliberately rather than by coincidence.
 */
export function assignableGroupRoles(
  actorRole: GroupRole,
): readonly GroupRole[] {
  if (actorRole === "owner") {
    return groupRoles;
  }
  if (actorRole === "admin") {
    return ["admin", "member"];
  }
  return [];
}

/** How much of the name survives into the slug before the suffix is added. */
const slugBaseMaxLength = 40;

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Builds the globally unique slug a new group is created with.
 *
 * Slugs are unique across the whole installation, not per account, so two people
 * naming a group "Team" would collide — the caller supplies a random `suffix`
 * and that is what separates them. Deriving the readable half from the name
 * keeps the identifier recognisable; folding the name away entirely when it
 * carries no slug characters keeps it valid.
 */
export function groupSlug(name: string, suffix: string): string {
  const base = slugify(name).slice(0, slugBaseMaxLength).replace(/-+$/g, "");
  return `${base === "" ? "group" : base}-${slugify(suffix)}`;
}
