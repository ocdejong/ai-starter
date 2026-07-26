import { describe, expect, it } from "vitest";

import { featureNames } from "./naming.ts";

describe("featureNames", () => {
  it("derives every form a slice needs from one word", () => {
    expect(featureNames("announcement")).toEqual({
      camel: "announcement",
      camelPlural: "announcements",
      kebab: "announcement",
      kebabPlural: "announcements",
      lower: "announcement",
      lowerPlural: "announcements",
      pascal: "Announcement",
      pascalPlural: "Announcements",
      title: "Announcement",
      titlePlural: "Announcements",
    });
  });

  it("keeps the product's own words in a multi-word name", () => {
    // The identifier forms run the words together; the copy forms keep the
    // space, because a heading reading "Releasenotes" is how a generator gives
    // itself away.
    expect(featureNames("release-note")).toEqual({
      camel: "releaseNote",
      camelPlural: "releaseNotes",
      kebab: "release-note",
      kebabPlural: "release-notes",
      lower: "release note",
      lowerPlural: "release notes",
      pascal: "ReleaseNote",
      pascalPlural: "ReleaseNotes",
      title: "Release note",
      titlePlural: "Release notes",
    });
  });

  it("pluralises the last word the way English does", () => {
    expect(featureNames("policy").kebabPlural).toBe("policies");
    expect(featureNames("address").kebabPlural).toBe("addresses");
    expect(featureNames("support-box").lowerPlural).toBe("support boxes");
    expect(featureNames("day").kebabPlural).toBe("days");
  });

  it("takes an explicit plural when English will not cooperate", () => {
    const names = featureNames("person", "people");

    expect(names.kebabPlural).toBe("people");
    expect(names.pascalPlural).toBe("People");
    expect(names.titlePlural).toBe("People");
  });

  it("refuses a name that is not a lower-case kebab word", () => {
    for (const invalid of [
      "Announcement",
      "announcement_v2",
      "",
      "-note",
      "2fa",
    ]) {
      expect(() => featureNames(invalid)).toThrow(/kebab-case/);
    }
  });

  it("refuses a plural that is the same as the singular", () => {
    // Several generated paths differ only by number; identical forms would make
    // the feature file and its directory collide.
    expect(() => featureNames("sheep", "sheep")).toThrow(/differ/);
  });
});
