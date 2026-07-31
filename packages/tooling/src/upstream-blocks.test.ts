import { describe, expect, it } from "vitest";

import {
  formatReviews,
  namesMajorAtLeast,
  reviewBlock,
  type Manifest,
  type UpstreamBlock,
  upstreamBlocks,
} from "./upstream-blocks.ts";

const block: UpstreamBlock = {
  dependency: "@jest/globals",
  field: "dependencies",
  issue: 38,
  pkg: "jest-expo",
  recorded: "^29.2.1",
  summary: "jest 30",
  wanted: 30,
};

const manifest = (
  dependencies: Record<string, string>,
  version = "57.0.2",
): Manifest => ({ dependencies, version });

describe("namesMajorAtLeast", () => {
  it("reads the majors a disjunction names", () => {
    const peers = "^3 || ^4 || ^5 || ^6 || ^7 || ^8 || ^9.7";
    expect(namesMajorAtLeast(peers, 10)).toBe(false);
    expect(namesMajorAtLeast(`${peers} || ^10`, 10)).toBe(true);
  });

  it("does not fire on patch churn inside a blocked major", () => {
    // The reason this is not a string comparison against the recorded range:
    // an upstream that ships 1.19.10 has not unblocked anything.
    expect(namesMajorAtLeast("^1.19.9", 2)).toBe(false);
    expect(namesMajorAtLeast("^1.19.20", 2)).toBe(false);
    expect(namesMajorAtLeast("^2.0.5", 2)).toBe(true);
  });

  it("reads an exact pin, which is how a transitive dependency arrives", () => {
    expect(namesMajorAtLeast("1.19.11", 2)).toBe(false);
    expect(namesMajorAtLeast("2.0.5", 2)).toBe(true);
  });
});

describe("reviewBlock", () => {
  it("holds while the upstream range still caps below the wanted major", () => {
    const review = reviewBlock(block, manifest({ "@jest/globals": "^29.2.1" }));
    expect(review.cleared).toBe(false);
    expect(review.observed).toBe("^29.2.1");
  });

  it("clears when the range reaches the wanted major", () => {
    const review = reviewBlock(block, manifest({ "@jest/globals": "^30.0.1" }));
    expect(review.cleared).toBe(true);
  });

  it("clears when the dependency is dropped entirely", () => {
    // Not hypothetical: `@prisma/dev` removed its `@hono/node-server`
    // dependency between 0.24.3 and 0.24.17, which is how that block ended.
    const review = reviewBlock(block, manifest({}));
    expect(review.cleared).toBe(true);
    expect(review.observed).toBeUndefined();
  });

  it("reads the field the block names, not whichever one has the key", () => {
    const peerBlock: UpstreamBlock = { ...block, field: "peerDependencies" };
    const review = reviewBlock(
      peerBlock,
      manifest({ "@jest/globals": "^30.0.1" }),
    );
    expect(review.cleared).toBe(true);
    expect(review.observed).toBeUndefined();
  });
});

describe("formatReviews", () => {
  it("says nothing to do while every block holds", () => {
    const held = reviewBlock(block, manifest({ "@jest/globals": "^29.2.1" }));
    expect(formatReviews([held])).toContain("still hold");
  });

  it("names the upstream version, both ranges, and the issue", () => {
    const cleared = reviewBlock(
      block,
      manifest({ "@jest/globals": "^30.0.1" }, "58.0.0"),
    );
    const report = formatReviews([cleared]);
    expect(report).toContain("jest-expo@58.0.0");
    expect(report).toContain("^30.0.1");
    expect(report).toContain("was ^29.2.1");
    expect(report).toContain("#38");
    expect(report).toContain("delete this block");
  });

  it("reports a dropped dependency as a clearance rather than a range", () => {
    const cleared = reviewBlock(block, manifest({}));
    expect(formatReviews([cleared])).toContain("no longer depends on");
  });
});

describe("the recorded blocks", () => {
  it("each name a distinct upstream package", () => {
    const packages = upstreamBlocks.map((entry) => entry.pkg);
    expect(new Set(packages).size).toBe(packages.length);
  });

  it("each record a range that does not already reach the wanted major", () => {
    // A block recorded as already-cleared would fire on its first run and
    // never stop, which reads as a broken sensor rather than a stale list.
    for (const entry of upstreamBlocks) {
      expect(namesMajorAtLeast(entry.recorded, entry.wanted)).toBe(false);
    }
  });
});
