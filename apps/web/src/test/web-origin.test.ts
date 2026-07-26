import { describe, expect, it } from "vitest";

import { envFileWebOrigin, resolveWebOrigin } from "./web-origin";

describe("envFileWebOrigin", () => {
  it("reads the quoted BETTER_AUTH_URL bootstrap writes", () => {
    const content = `BETTER_AUTH_SECRET="s"\nBETTER_AUTH_URL="http://localhost:3042"\n`;

    expect(envFileWebOrigin(content)).toBe("http://localhost:3042");
  });

  it("reads an unquoted value", () => {
    expect(envFileWebOrigin("BETTER_AUTH_URL=http://localhost:3042\n")).toBe(
      "http://localhost:3042",
    );
  });

  it("returns undefined when the file does not set the variable", () => {
    expect(envFileWebOrigin('DATABASE_URL="postgresql://x"\n')).toBeUndefined();
  });

  it("returns undefined for an empty value", () => {
    expect(envFileWebOrigin('BETTER_AUTH_URL=""\n')).toBeUndefined();
  });
});

describe("resolveWebOrigin", () => {
  const envFile = `BETTER_AUTH_URL="http://localhost:3042"\n`;

  it("prefers an explicit override over the env file", () => {
    expect(resolveWebOrigin("http://localhost:4000", envFile)).toBe(
      "http://localhost:4000",
    );
  });

  it("ignores an empty override", () => {
    expect(resolveWebOrigin("", envFile)).toBe("http://localhost:3042");
  });

  it("falls back to the env file's BETTER_AUTH_URL", () => {
    expect(resolveWebOrigin(undefined, envFile)).toBe("http://localhost:3042");
  });

  it("defaults to localhost:3000 without an override or env file", () => {
    expect(resolveWebOrigin(undefined, undefined)).toBe(
      "http://localhost:3000",
    );
  });
});
