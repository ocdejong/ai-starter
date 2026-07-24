import { describe, expect, it } from "vitest";

import {
  chatCheck,
  emailCheck,
  formatChecks,
  hasFailure,
  majorOf,
  minimumMajor,
  nodeCheck,
  pinnedVersion,
  rangeAllowsMajor,
  type Check,
} from "./diagnostics.ts";

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

describe("engines range evaluation", () => {
  it("evaluates every ||-clause, so a gap between clauses is rejected", () => {
    expect(rangeAllowsMajor("^24 || >=26", 24)).toBe(true);
    expect(rangeAllowsMajor("^24 || >=26", 25)).toBe(false);
    expect(rangeAllowsMajor("^24 || >=26", 26)).toBe(true);
    expect(rangeAllowsMajor("^24 || >=26", 27)).toBe(true);
    expect(rangeAllowsMajor("^24 || >=26", 23)).toBe(false);
  });

  it("reads dependency-cruiser's unspaced clause form", () => {
    expect(rangeAllowsMajor("^22||^24||>=26", 22)).toBe(true);
    expect(rangeAllowsMajor("^22||^24||>=26", 23)).toBe(false);
    expect(rangeAllowsMajor("^22||^24||>=26", 25)).toBe(false);
    expect(rangeAllowsMajor("^22||^24||>=26", 30)).toBe(true);
  });

  it("still accepts a plain floor", () => {
    expect(rangeAllowsMajor(">=24", 25)).toBe(true);
    expect(rangeAllowsMajor(">=24", 23)).toBe(false);
  });

  it("handles comparator pairs and full versions at major granularity", () => {
    expect(rangeAllowsMajor(">=22 <25", 24)).toBe(true);
    expect(rangeAllowsMajor(">=22 <25", 25)).toBe(false);
    expect(rangeAllowsMajor("^20.11.0", 20)).toBe(true);
    expect(rangeAllowsMajor("^20.11.0", 21)).toBe(false);
  });

  it("returns undefined for a range it cannot read", () => {
    expect(rangeAllowsMajor("latest", 24)).toBeUndefined();
    expect(rangeAllowsMajor("^24 || latest", 24)).toBeUndefined();
  });
});

describe("Node.js check", () => {
  it("passes a version inside the range", () => {
    const check = nodeCheck("^24 || >=26", "24.18.0");
    expect(check.status).toBe("ok");
    expect(check.fix).toBeUndefined();
  });

  it("fails an excluded non-LTS major and names the arch gate", () => {
    const check = nodeCheck("^24 || >=26", "25.9.0");
    expect(check.status).toBe("failure");
    expect(check.detail).toContain("pnpm arch");
    expect(check.fix).toContain("nvm");
    expect(check.fix).toContain("mise");
  });

  it("fails a version below the floor as too old", () => {
    const check = nodeCheck("^24 || >=26", "22.4.0");
    expect(check.status).toBe("failure");
    expect(check.detail).toContain("older");
    expect(check.fix).toBeDefined();
  });

  it("warns when no range is declared or readable", () => {
    expect(nodeCheck(undefined, "24.18.0").status).toBe("warning");
    expect(nodeCheck("latest", "24.18.0").status).toBe("warning");
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

describe("transactional email check", () => {
  it("passes and points at the dev mailbox when no key is set", () => {
    const check = emailCheck(undefined, undefined);
    expect(check.status).toBe("ok");
    expect(check.detail).toContain("dev mailbox");
    expect(check.fix).toBeUndefined();
  });

  it("treats an empty key like an absent one", () => {
    expect(emailCheck("", "AI Starter <a@b.com>").status).toBe("ok");
  });

  it("fails when the key does not begin with re_", () => {
    const check = emailCheck("sk_live_123", "AI Starter <a@b.com>");
    expect(check.status).toBe("failure");
    expect(check.fix).toContain("re_");
  });

  it("warns when a key is set without a from address", () => {
    const check = emailCheck("re_abc123", "");
    expect(check.status).toBe("warning");
    expect(check.fix).toContain("EMAIL_FROM");
  });

  it("passes when both the key and from address are set", () => {
    const check = emailCheck("re_abc123", "AI Starter <a@b.com>");
    expect(check.status).toBe("ok");
    expect(check.detail).toContain("Resend");
  });
});

describe("LLM chat check", () => {
  it("passes and says chat is unconfigured when no key is set", () => {
    const check = chatCheck(undefined, undefined);
    expect(check.status).toBe("ok");
    expect(check.detail).toContain("not configured");
    expect(check.fix).toBeUndefined();
  });

  it("treats an empty key like an absent one", () => {
    expect(chatCheck("", "claude-sonnet-5").status).toBe("ok");
  });

  it("fails when the key does not begin with sk-ant-", () => {
    const check = chatCheck("re_abc123", "claude-sonnet-5");
    expect(check.status).toBe("failure");
    expect(check.fix).toContain("sk-ant-");
  });

  it("names the default model when a key is set without one", () => {
    const check = chatCheck("sk-ant-abc123", "");
    expect(check.status).toBe("ok");
    expect(check.detail).toContain("claude-sonnet-5");
  });

  it("names the configured model when both are set", () => {
    const check = chatCheck("sk-ant-abc123", "claude-opus-4-8");
    expect(check.status).toBe("ok");
    expect(check.detail).toContain("claude-opus-4-8");
  });
});
