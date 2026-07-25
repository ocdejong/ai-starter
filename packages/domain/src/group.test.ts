import { describe, expect, it } from "vitest";

import {
  assignableGroupRoles,
  createGroupInputSchema,
  groupErrorFor,
  groupNamePolicy,
  groupSlug,
  inviteMemberInputSchema,
  parseGroupRole,
  parseGroupValidationCode,
} from "./group";

describe("group name", () => {
  it("trims the name it accepts", () => {
    const result = createGroupInputSchema.safeParse({ name: "  Book Club  " });

    expect(result.success && result.data.name).toBe("Book Club");
  });

  it("reports an empty name and an over-long one by code", () => {
    expect(
      createGroupInputSchema.safeParse({ name: "   " }).error?.issues[0]
        ?.message,
    ).toBe("groupNameRequired");
    expect(
      createGroupInputSchema.safeParse({
        name: "a".repeat(groupNamePolicy.maxLength + 1),
      }).error?.issues[0]?.message,
    ).toBe("groupNameTooLong");
  });
});

describe("invitation input", () => {
  it("normalises the address so one identity is one member", () => {
    const result = inviteMemberInputSchema.safeParse({
      email: "  Reader@Example.COM ",
      role: "member",
    });

    expect(result.success && result.data.email).toBe("reader@example.com");
  });

  it("refuses an address that is not one, and a role that does not exist", () => {
    expect(
      inviteMemberInputSchema.safeParse({ email: "nope", role: "member" }).error
        ?.issues[0]?.message,
    ).toBe("emailInvalid");
    expect(
      inviteMemberInputSchema.safeParse({
        email: "reader@example.com",
        role: "superuser",
      }).success,
    ).toBe(false);
  });
});

describe("role parsing", () => {
  it("narrows a stored role and rejects anything else", () => {
    expect(parseGroupRole("owner")).toBe("owner");
    // Better Auth stores roles as a comma-separated string, so a multi-role
    // member is a shape this application does not assign and must not display
    // as though it were a single known role.
    expect(parseGroupRole("owner,admin")).toBeNull();
    expect(parseGroupRole(undefined)).toBeNull();
  });

  it("narrows a validation code and rejects anything else", () => {
    expect(parseGroupValidationCode("groupNameRequired")).toBe(
      "groupNameRequired",
    );
    expect(parseGroupValidationCode("Required")).toBeNull();
  });
});

describe("assignable roles", () => {
  it("lets an owner hand out every role, including their own", () => {
    expect(assignableGroupRoles("owner")).toEqual(["owner", "admin", "member"]);
  });

  it("withholds the owner role from an admin", () => {
    expect(assignableGroupRoles("admin")).toEqual(["admin", "member"]);
  });

  it("gives a plain member nothing to assign", () => {
    expect(assignableGroupRoles("member")).toEqual([]);
  });
});

describe("group errors", () => {
  it("names the refusals a person can act on", () => {
    expect(groupErrorFor("USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION")).toBe(
      "alreadyMember",
    );
    expect(
      groupErrorFor("YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER"),
    ).toBe("lastOwner");
    expect(
      groupErrorFor("YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER"),
    ).toBe("lastOwner");
    expect(
      groupErrorFor("YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_ORGANIZATION"),
    ).toBe("notAllowed");
    expect(groupErrorFor("YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_MEMBER")).toBe(
      "notAllowed",
    );
    expect(groupErrorFor("USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION")).toBe(
      "notAllowed",
    );
  });

  it("falls back rather than showing a code nobody wrote copy for", () => {
    expect(groupErrorFor("SOMETHING_NEW_IN_A_LATER_RELEASE")).toBe(
      "unexpected",
    );
    expect(groupErrorFor(undefined)).toBe("unexpected");
  });
});

describe("group slug", () => {
  it("derives a URL-safe slug from the name and keeps the suffix", () => {
    expect(groupSlug("Book Club", "7f3k2a")).toBe("book-club-7f3k2a");
  });

  it("folds diacritics and collapses punctuation into single separators", () => {
    expect(groupSlug("Café  Möbius & Co.", "abc123")).toBe(
      "cafe-mobius-co-abc123",
    );
  });

  it("falls back to a stable base when the name carries no slug characters", () => {
    // The suffix is what keeps this unique, so a name of only emoji still
    // produces a slug the database will accept.
    expect(groupSlug("🌱🌱", "abc123")).toBe("group-abc123");
  });

  it("truncates a long name so the slug stays readable", () => {
    expect(groupSlug("a".repeat(80), "abc123")).toBe(
      `${"a".repeat(40)}-abc123`,
    );
  });
});
