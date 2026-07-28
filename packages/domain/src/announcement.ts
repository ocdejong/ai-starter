import { z } from "zod";

/**
 * The bounds an announcement title has to satisfy, shared by web and native.
 *
 * The maximum mirrors the column the adapter writes to, so a title that would be
 * refused by PostgreSQL is refused by the form first — the constraint stays in
 * both places on purpose, because only one of them survives a direct write.
 */
export const announcementTitlePolicy = { maxLength: 120 } as const;

/**
 * Every validation failure these schemas can report, as stable codes rather than
 * prose. Domain code is platform-neutral and cannot reach a message catalog, so
 * it names the problem and the interface translates it: each code is also a key
 * under the feature's own `validation` namespace in both locales, and
 * `typecheck` is what proves none is missing.
 */
export const announcementValidationCodes = [
  "announcementTitleRequired",
  "announcementTitleTooLong",
] as const;

export type AnnouncementValidationCode =
  (typeof announcementValidationCodes)[number];

const announcementValidationCodeSchema = z.enum(announcementValidationCodes);

/** Narrows a form-library message back to a code a catalog can translate. */
export function parseAnnouncementValidationCode(
  value: unknown,
): AnnouncementValidationCode | null {
  const result = announcementValidationCodeSchema.safeParse(value);
  return result.success ? result.data : null;
}

const announcementTitleSchema = z
  .string()
  .trim()
  .min(1, { error: "announcementTitleRequired" })
  .max(announcementTitlePolicy.maxLength, {
    error: "announcementTitleTooLong",
  });

/**
 * Creating one takes a title and nothing else. The group it belongs to and the
 * account that wrote it are established by the request, never sent with it — a
 * client that could name either would be choosing what it is allowed to change.
 */
export const createAnnouncementInputSchema = z.object({
  title: announcementTitleSchema,
});

/**
 * Renaming names one announcement. The identifier is only half of the answer:
 * the procedure pairs it with the group behind the request, so an identifier
 * from another group matches no row rather than a row someone else owns.
 */
export const renameAnnouncementInputSchema = z.object({
  announcementId: z.string().min(1),
  title: announcementTitleSchema,
});

export type CreateAnnouncementInput = z.infer<
  typeof createAnnouncementInputSchema
>;
export type RenameAnnouncementInput = z.infer<
  typeof renameAnnouncementInputSchema
>;
