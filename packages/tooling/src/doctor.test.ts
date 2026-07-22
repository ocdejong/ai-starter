import { describe, expect, it } from "vitest";

import {
  formatChecks,
  hasFailure,
  majorOf,
  minimumMajor,
  pinnedVersion,
  type Check,
} from "./doctor.ts";

describe("version parsing", () => {
  it("reads the minimum major from an engines range", () => {
    expect(minimumMajor(">=24")).toBe(24);
    expect(minimumMajor("^20.11.0")).toBe(20);
    expect(minimumMajor("latest")).toBeUndefined();
  });

  it("reads the major from a runtime version", () => {
    expect(majorOf("v24.18.0")).toBe(24);
    expect(majorOf("10.32.1")).toBe(10);
  });

  it("reads the version out of a packageManager pin", () => {
    expect(pinnedVersion("pnpm@10.32.1")).toBe("10.32.1");
    expect(pinnedVersion("pnpm@10.32.1+sha512.abc")).toBe("10.32.1");
  });
});

describe("reporting", () => {
  const checks: Check[] = [
    { detail: "fine", name: "First", status: "ok" },
    {
      detail: "unusual",
      fix: "run something",
      name: "Second",
      status: "warning",
    },
    {
      detail: "broken",
      fix: "run something else",
      name: "Third",
      status: "failure",
    },
  ];

  it("fails only when a check failed", () => {
    expect(hasFailure(checks)).toBe(true);
    expect(hasFailure(checks.slice(0, 2))).toBe(false);
  });

  it("prints the actionable fix beneath every problem", () => {
    const report = formatChecks(checks);

    expect(report).toContain("OK    First: fine");
    expect(report).toContain("fix: run something");
    expect(report).toContain("FAIL  Third: broken");
  });

  it("prints no fix line for a passing check", () => {
    expect(formatChecks(checks.slice(0, 1))).not.toContain("fix:");
  });
});
