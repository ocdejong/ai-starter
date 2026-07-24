import { describe, expect, it } from "vitest";
import { type ZodSafeParseResult } from "zod";

import {
  authValidationCodes,
  parseAuthValidationCode,
  passwordPolicy,
  requestPasswordResetInputSchema,
  resetPasswordInputSchema,
  signInInputSchema,
  signUpInputSchema,
} from "./auth";

/**
 * Reads the code a schema reported for one field. Every message these schemas
 * emit is a stable code rather than prose, so the platforms can translate it;
 * these tests assert the codes, which is the contract the UI depends on.
 */
function codeFor(
  result: ZodSafeParseResult<unknown>,
  field: string,
): string | undefined {
  return result.error?.issues.find((issue) => issue.path[0] === field)?.message;
}

describe("signUpInputSchema", () => {
  const valid = {
    email: "ada@example.com",
    name: "Ada Lovelace",
    password: "correct horse battery",
  };

  it("accepts a well-formed registration", () => {
    expect(signUpInputSchema.safeParse(valid).success).toBe(true);
  });

  it("trims the name and lowercases the email so one account is one identity", () => {
    const parsed = signUpInputSchema.parse({
      ...valid,
      email: "  Ada@Example.COM ",
      name: "  Ada Lovelace  ",
    });

    expect(parsed).toMatchObject({
      email: "ada@example.com",
      name: "Ada Lovelace",
    });
  });

  it("reports a translatable code for an address that is not an email", () => {
    expect(
      codeFor(signUpInputSchema.safeParse({ ...valid, email: "ada" }), "email"),
    ).toBe("emailInvalid");
  });

  it("reports a translatable code for a name of only whitespace", () => {
    expect(
      codeFor(signUpInputSchema.safeParse({ ...valid, name: "   " }), "name"),
    ).toBe("nameRequired");
  });

  it("rejects a password below the minimum the auth server enforces", () => {
    const short = "a".repeat(passwordPolicy.minLength - 1);

    expect(
      codeFor(
        signUpInputSchema.safeParse({ ...valid, password: short }),
        "password",
      ),
    ).toBe("passwordTooShort");
  });

  it("accepts a password exactly at the minimum", () => {
    const exact = "a".repeat(passwordPolicy.minLength);

    expect(
      signUpInputSchema.safeParse({ ...valid, password: exact }).success,
    ).toBe(true);
  });

  it("rejects a password above the maximum the auth server accepts", () => {
    const long = "a".repeat(passwordPolicy.maxLength + 1);

    expect(
      codeFor(
        signUpInputSchema.safeParse({ ...valid, password: long }),
        "password",
      ),
    ).toBe("passwordTooLong");
  });
});

describe("signInInputSchema", () => {
  it("accepts any non-empty password, because an existing one predates the policy", () => {
    expect(
      signInInputSchema.safeParse({ email: "ada@example.com", password: "old" })
        .success,
    ).toBe(true);
  });

  it("still requires a password to be typed", () => {
    expect(
      codeFor(
        signInInputSchema.safeParse({ email: "ada@example.com", password: "" }),
        "password",
      ),
    ).toBe("passwordRequired");
  });
});

describe("requestPasswordResetInputSchema", () => {
  it("requires a valid email", () => {
    expect(
      codeFor(
        requestPasswordResetInputSchema.safeParse({ email: "nope" }),
        "email",
      ),
    ).toBe("emailInvalid");
  });
});

describe("resetPasswordInputSchema", () => {
  it("accepts a matching pair that satisfies the policy", () => {
    expect(
      resetPasswordInputSchema.safeParse({
        confirmPassword: "a new long password",
        password: "a new long password",
      }).success,
    ).toBe(true);
  });

  it("reports the mismatch on the confirmation field, where the user can fix it", () => {
    expect(
      codeFor(
        resetPasswordInputSchema.safeParse({
          confirmPassword: "a different password",
          password: "a new long password",
        }),
        "confirmPassword",
      ),
    ).toBe("passwordMismatch");
  });

  it("applies the password policy to the new password", () => {
    const short = "a".repeat(passwordPolicy.minLength - 1);

    expect(
      codeFor(
        resetPasswordInputSchema.safeParse({
          confirmPassword: short,
          password: short,
        }),
        "password",
      ),
    ).toBe("passwordTooShort");
  });
});

describe("parseAuthValidationCode", () => {
  it("recognises every code the schemas can emit", () => {
    for (const code of authValidationCodes) {
      expect(parseAuthValidationCode(code)).toBe(code);
    }
  });

  it("returns null for anything else, so a stray message never reaches a catalog lookup", () => {
    expect(parseAuthValidationCode("Required")).toBeNull();
    expect(parseAuthValidationCode(undefined)).toBeNull();
    expect(parseAuthValidationCode(42)).toBeNull();
  });
});
