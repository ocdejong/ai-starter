import { describe, expect, it } from "vitest";

import { parseEnvFile, setEnvValue } from "./env-file.ts";

const sample = [
  "# A comment",
  'BETTER_AUTH_SECRET=""',
  'DATABASE_URL="postgresql://postgres:password@localhost:5433/example_db"',
  "EXPO_PUBLIC_API_URL=http://localhost:3000 # trailing comment",
  "export EXPORTED='quoted'",
  "",
].join("\n");

describe("parseEnvFile", () => {
  it("reads quoted, unquoted and exported assignments", () => {
    const values = parseEnvFile(sample);

    expect(values.get("BETTER_AUTH_SECRET")).toBe("");
    expect(values.get("DATABASE_URL")).toBe(
      "postgresql://postgres:password@localhost:5433/example_db",
    );
    expect(values.get("EXPO_PUBLIC_API_URL")).toBe("http://localhost:3000");
    expect(values.get("EXPORTED")).toBe("quoted");
  });

  it("ignores comments and blank lines", () => {
    expect(parseEnvFile("# only a comment\n\n").size).toBe(0);
  });
});

describe("setEnvValue", () => {
  it("replaces an existing assignment in place", () => {
    const updated = setEnvValue(sample, "BETTER_AUTH_SECRET", "generated");

    expect(parseEnvFile(updated).get("BETTER_AUTH_SECRET")).toBe("generated");
    expect(updated.split("\n")[0]).toBe("# A comment");
    expect(updated.split("\n")).toHaveLength(sample.split("\n").length);
  });

  it("appends an assignment that does not exist yet", () => {
    const updated = setEnvValue(sample, "NEW_VALUE", "present");

    expect(parseEnvFile(updated).get("NEW_VALUE")).toBe("present");
  });

  it("appends a newline when the file does not end with one", () => {
    expect(setEnvValue("A=1", "B", "2")).toBe('A=1\nB="2"\n');
  });
});
