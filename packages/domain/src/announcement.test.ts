import { describe, expect, it } from "vitest";

import {
  announcementTitlePolicy,
  parseAnnouncementValidationCode,
  publishAnnouncementInputSchema,
  renameAnnouncementInputSchema,
} from "./announcement";

describe("publishAnnouncementInputSchema", () => {
  it("trims the title before it reaches the database", () => {
    const result = publishAnnouncementInputSchema.safeParse({
      title: "  Office closed on Friday  ",
    });

    expect(result).toMatchObject({
      data: { title: "Office closed on Friday" },
      success: true,
    });
  });

  it("reports a blank title as a stable code", () => {
    const result = publishAnnouncementInputSchema.safeParse({ title: "   " });

    expect(result.error?.issues[0]?.message).toBe("announcementTitleRequired");
  });

  it("reports a title past the column limit as a stable code", () => {
    const result = publishAnnouncementInputSchema.safeParse({
      title: "x".repeat(announcementTitlePolicy.maxLength + 1),
    });

    expect(result.error?.issues[0]?.message).toBe("announcementTitleTooLong");
  });
});

describe("renameAnnouncementInputSchema", () => {
  it("requires the announcement it renames", () => {
    const result = renameAnnouncementInputSchema.safeParse({
      announcementId: "",
      title: "Still closed",
    });

    expect(result.success).toBe(false);
  });
});

describe("parseAnnouncementValidationCode", () => {
  it("narrows a code the catalog can translate", () => {
    expect(parseAnnouncementValidationCode("announcementTitleTooLong")).toBe(
      "announcementTitleTooLong",
    );
  });

  it("refuses anything else rather than guessing", () => {
    expect(parseAnnouncementValidationCode("String must contain…")).toBeNull();
  });
});
