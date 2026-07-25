import { z } from "zod";

/**
 * The password bounds the auth server enforces. Better Auth's own defaults are
 * 8 and 128; mirroring them here means a user learns about a too-short password
 * from the field they are typing in rather than from a rejected request, and web
 * and native read the same numbers.
 */
export const passwordPolicy = {
  maxLength: 128,
  minLength: 8,
} as const;

/**
 * Every validation failure these schemas can report. They are stable codes, not
 * prose: the schemas are platform-neutral and cannot reach a message catalog, so
 * each UI translates the code it receives. A code here is a catalog key under
 * `auth.validation`, and the catalogs' key set is checked against this list.
 */
export const authValidationCodes = [
  "emailInvalid",
  "emailUnchanged",
  "nameRequired",
  "nameTooLong",
  "passwordMismatch",
  "passwordRequired",
  "passwordTooLong",
  "passwordTooShort",
] as const;

export type AuthValidationCode = (typeof authValidationCodes)[number];

const authValidationCodeSchema = z.enum(authValidationCodes);

/**
 * Narrows a message carried out of a form library back to a known code. Form
 * state is stringly typed by the time a field error reaches the view, so this is
 * the boundary that decides whether a message may be used as a catalog key —
 * anything unrecognised becomes `null` and is rendered as a generic failure
 * instead of a missing-translation crash.
 */
export function parseAuthValidationCode(
  value: unknown,
): AuthValidationCode | null {
  const result = authValidationCodeSchema.safeParse(value);
  return result.success ? result.data : null;
}

/** One account is one identity, so the stored address is always normalised. */
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "emailInvalid" }));

const nameSchema = z
  .string()
  .trim()
  .min(1, { error: "nameRequired" })
  .max(100, { error: "nameTooLong" });

/** The policy new passwords must satisfy. */
const newPasswordSchema = z
  .string()
  .min(passwordPolicy.minLength, { error: "passwordTooShort" })
  .max(passwordPolicy.maxLength, { error: "passwordTooLong" });

export const signUpInputSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  password: newPasswordSchema,
});

/**
 * Sign-in deliberately does not apply the password policy. An account created
 * before a policy change still has to be able to sign in, and telling a visitor
 * their attempt is "too short" would leak that it failed the policy rather than
 * the credential check.
 */
export const signInInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: "passwordRequired" }),
});

export const requestPasswordResetInputSchema = z.object({
  email: emailSchema,
});

export const resetPasswordInputSchema = z
  .object({
    confirmPassword: z.string(),
    password: newPasswordSchema,
  })
  .refine((value) => value.password === value.confirmPassword, {
    error: "passwordMismatch",
    // Reported on the confirmation field: that is the one the user retypes.
    path: ["confirmPassword"],
  });

/**
 * The account-settings inputs. They belong beside the flows above because they
 * report the same codes and answer to the same password policy — the difference
 * is only who is asking: someone who has already proved who they are.
 */
export const updateProfileInputSchema = z.object({
  name: nameSchema,
});

/**
 * Built against the address the account uses today, because "the same address"
 * is the one refusal the auth server cannot express in a code: it answers with a
 * bare 400 and a prose message, which no UI may translate. Deciding it here
 * gives the person an answer in the field they are typing in, and gives both
 * platforms the same rule.
 */
export function changeEmailInputSchemaFor(currentEmail: string) {
  const current = currentEmail.trim().toLowerCase();

  return z.object({
    newEmail: emailSchema.refine((value) => value !== current, {
      error: "emailUnchanged",
    }),
  });
}

/**
 * Changing a password re-proves the current one. That check is a credential
 * comparison rather than a new secret, so — like signing in — it deliberately
 * escapes the password policy: an account whose password predates a policy
 * change must still be able to replace it.
 */
export const changePasswordInputSchema = z
  .object({
    confirmPassword: z.string(),
    currentPassword: z.string().min(1, { error: "passwordRequired" }),
    newPassword: newPasswordSchema,
    revokeOtherSessions: z.boolean(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    error: "passwordMismatch",
    // Reported on the confirmation field: that is the one the user retypes.
    path: ["confirmPassword"],
  });

export type SignUpInput = z.infer<typeof signUpInputSchema>;
export type SignInInput = z.infer<typeof signInInputSchema>;
export type RequestPasswordResetInput = z.infer<
  typeof requestPasswordResetInputSchema
>;
export type ResetPasswordInput = z.infer<typeof resetPasswordInputSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>;
export type ChangeEmailInput = z.infer<
  ReturnType<typeof changeEmailInputSchemaFor>
>;
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;
