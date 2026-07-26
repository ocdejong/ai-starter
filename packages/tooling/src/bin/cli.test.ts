import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { listTextFiles } from "../repository-files.ts";

const binaryDirectory = import.meta.dirname;
const commands = listTextFiles(binaryDirectory).filter(
  (file) => file.endsWith(".ts") && !file.endsWith(".test.ts"),
);

/**
 * Node runs these commands directly, by stripping types rather than compiling.
 * Type stripping rejects constructs a type-checked build accepts — parameter
 * properties and enums among them — so every command is executed here rather
 * than only typechecked.
 */
describe("command entry points", () => {
  it("finds every command", () => {
    expect(commands.sort()).toEqual([
      "bootstrap.ts",
      "db-push-prototype.ts",
      "db-seed.ts",
      "diagnose.ts",
      "generate.ts",
      "instructions.ts",
      "policy.ts",
      "repo-host.ts",
      "starter-init.ts",
      "verify-changed.ts",
      "verify.ts",
    ]);
  });

  it.each(commands)("node runs %s and it prints its usage", (command) => {
    const result = spawnSync(
      process.execPath,
      [path.join(binaryDirectory, command), "--help"],
      { encoding: "utf8" },
    );

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage: pnpm ");
  });
});
