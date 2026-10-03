import { describe, expect, it } from "vitest";

import { runCapture } from "./command.ts";

describe("runCapture", () => {
  // depcruise's JSON for this repository passes one megabyte, which is
  // spawnSync's default `maxBuffer`; at that point the child is killed and the
  // caller sees a truncated document with an exit code that blames the tool.
  it("captures output larger than spawnSync's default buffer intact", () => {
    const bytes = 4 * 1024 * 1024;
    const result = runCapture(
      process.execPath,
      ["-e", `process.stdout.write("x".repeat(${String(bytes)}))`],
      { cwd: process.cwd() },
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toHaveLength(bytes);
  });

  it("reports a spawn failure in stderr rather than hiding it behind an empty string", () => {
    const result = runCapture("ai-starter-no-such-command", [], {
      cwd: process.cwd(),
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("ENOENT");
  });

  it("keeps what the child wrote to stderr when it fails", () => {
    const result = runCapture(
      process.execPath,
      ["-e", 'process.stderr.write("boom"); process.exit(3)'],
      { cwd: process.cwd() },
    );

    expect(result.code).toBe(3);
    expect(result.stderr).toBe("boom");
  });
});
