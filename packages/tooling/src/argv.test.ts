import { describe, expect, it } from "vitest";

import { ArgumentError, parseArguments } from "./argv.ts";

const options = { flags: ["name", "scope"], switches: ["help"] };

describe("parseArguments", () => {
  it("accepts separated and joined flag values", () => {
    const parsed = parseArguments(
      ["--name", "Acme Notes", "--scope=acme"],
      options,
    );

    expect(parsed.flags.get("name")).toBe("Acme Notes");
    expect(parsed.flags.get("scope")).toBe("acme");
  });

  it("accepts declared switches", () => {
    expect(parseArguments(["--help"], options).switches.has("help")).toBe(true);
  });

  it.each([
    ["an unknown option", ["--unknown", "value"]],
    ["a positional argument", ["value"]],
    ["a flag without a value", ["--name"]],
    ["a flag followed by another flag", ["--name", "--help"]],
    ["a switch given a value", ["--help=yes"]],
  ])("rejects %s", (_case, argv) => {
    expect(() => parseArguments(argv, options)).toThrow(ArgumentError);
  });
});
