/**
 * The releases this repository cannot take, and the upstream fact holding each
 * one back.
 *
 * These are the declines that have no local trigger. A Dependabot group
 * re-proposed jest 30 every month until jest-expo 58 moved, it failed for a
 * reason nothing here could fix, and it was closed again — and the day the
 * upstream release lands, *nothing in this repository notices*. That is the shape stage
 * 21 exists to kill: a decision that lives in somebody's memory rather than in
 * the repository.
 *
 * This sensor is the trigger. It reads the upstream manifests and fails when
 * one of them stops saying what is recorded here — which happens exactly when
 * a block clears.
 *
 * The red therefore means "this file is now stale", not "something broke". That
 * is a true statement about the repository and it is why this fits the failure
 * semantics the other sensors use, rather than inverting them: they ask "is
 * something wrong that nobody has noticed", and a decline that is no longer
 * true is exactly that.
 */

/** The npm registry's document for a package's `latest`. */
export type Manifest = {
  readonly version: string;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
};

export type UpstreamBlock = {
  /** What is blocked, in the words the report uses. */
  readonly summary: string;
  /** The package whose manifest carries the answer. */
  readonly pkg: string;
  /** Which manifest field to read. */
  readonly field: "dependencies" | "peerDependencies";
  /** The entry in that field whose range decides it. */
  readonly dependency: string;
  /**
   * The release this repository is waiting for: a major such as `"30"` for a
   * declined major, or a full version such as `"3.22.1"` for an advisory fixed
   * inside the major the upstream pins.
   */
  readonly wanted: string;
  /** What that range said when this block was recorded, for the diff. */
  readonly recorded: string;
  /** The issue tracking the block. */
  readonly issue: number;
};

/**
 * Recorded 2026-11-22 against the newest published version at the time. A block that clears is deleted from this
 * list in the same change that takes the bump — the list is the backlog, not a
 * log. The `effect` entry also has an `auditConfig.ignoreGhsas` entry in
 * `pnpm-workspace.yaml`, which goes in the same change.
 */
export const upstreamBlocks: readonly UpstreamBlock[] = [
  {
    dependency: "effect",
    field: "dependencies",
    issue: 23,
    pkg: "@prisma/config",
    recorded: "3.20.0",
    summary:
      "effect GHSA-7589-6fvf-x4pw is fixed in 3.22.1, but `@prisma/config` pins 3.20.0 exactly, so no override honours its range; the code runs in the Prisma CLI's config loader at development time",
    wanted: "3.22.1",
  },
];

/**
 * Whether a range admits a release at least as new as `wanted`.
 *
 * Deliberately not semver: `packages/tooling` may import nothing installed, and
 * the question is narrow enough to answer from the versions a range names. An
 * exact pin or a bare version reaches `wanted` when it is at least that
 * release; `^` also reaches it from below inside the same major, and `~` inside
 * the same minor. So `^9.7` never reaches `"10"`, and patch churn inside a
 * blocked major does not fire, which is the whole reason this is not a string
 * comparison against `recorded`.
 *
 * The one shape it would misread is an exclusive upper bound — `<3` names 3
 * without allowing it. No upstream here uses one, and a false "unblocked"
 * costs a person one command to disprove, where a false "still blocked" would
 * cost the silence this sensor exists to end.
 */
export function namesVersionAtLeast(range: string, wanted: string): boolean {
  const target = versionParts(wanted);
  return [...range.matchAll(/(?:^|[\s|,>=<])([~^]?)(\d+(?:\.\d+){0,2})/g)].some(
    (match) => {
      const named = versionParts(match[2] ?? "");
      const sameMajor = named[0] === target[0];
      const sameMinor = sameMajor && named[1] === target[1];
      return (
        compareParts(named, target) >= 0 ||
        (match[1] === "^" && sameMajor) ||
        (match[1] === "~" && sameMinor)
      );
    },
  );
}

function versionParts(version: string): readonly [number, number, number] {
  const [major = 0, minor = 0, patch = 0] = version.split(".").map(Number);
  return [major, minor, patch];
}

function compareParts(
  left: readonly [number, number, number],
  right: readonly [number, number, number],
): number {
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
}

export type BlockReview = {
  readonly block: UpstreamBlock;
  /** The range found now, or undefined when the dependency is gone entirely. */
  readonly observed: string | undefined;
  /** The version of the upstream package that was read. */
  readonly version: string;
  readonly cleared: boolean;
};

export function reviewBlock(
  block: UpstreamBlock,
  manifest: Manifest,
): BlockReview {
  const observed = manifest[block.field]?.[block.dependency];
  return {
    block,
    cleared:
      observed === undefined || namesVersionAtLeast(observed, block.wanted),
    observed,
    version: manifest.version,
  };
}

export function formatReviews(reviews: readonly BlockReview[]): string {
  const cleared = reviews.filter((review) => review.cleared);
  if (cleared.length === 0) {
    const names = reviews.map((review) => review.block.pkg).join(", ");
    return `upstream: ${String(reviews.length)} block(s) still hold — ${names}. Nothing to do.`;
  }

  const lines = cleared.map((review) => {
    const now =
      review.observed === undefined
        ? `no longer depends on ${review.block.dependency}`
        : `now asks for ${review.block.dependency} ${review.observed}`;
    return [
      `${review.block.pkg}@${review.version} ${now} (was ${review.block.recorded}).`,
      `  Unblocks: ${review.block.summary}.`,
      `  Take the bump, then delete this block from upstreamBlocks.ts. Tracked in #${String(review.block.issue)}.`,
    ].join("\n");
  });

  return [
    `upstream: ${String(cleared.length)} of ${String(reviews.length)} block(s) have cleared.`,
    ...lines,
  ].join("\n");
}
