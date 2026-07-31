/**
 * The majors this repository cannot take, and the upstream fact holding each
 * one back.
 *
 * These are the declines that have no local trigger. A Dependabot group
 * re-proposes eslint 10 and jest 30 every Monday, each fails for a reason
 * nothing here can fix, and each is closed again — and the day the upstream
 * release lands, *nothing in this repository notices*. That is the shape stage
 * 21 exists to kill: a decision that lives in somebody's memory rather than in
 * the repository.
 *
 * This sensor is the trigger. It reads the upstream manifests and fails when
 * one of them stops saying what is recorded here — which happens exactly when
 * a block clears.
 *
 * The red therefore means "this file is now stale", not "something broke". That
 * is a true statement about the repository and it is why this fits the failure
 * semantics the other four sensors use, rather than inverting them: the four
 * ask "is something wrong that nobody has noticed", and a decline that is no
 * longer true is exactly that.
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
  /** The major this repository is waiting for. */
  readonly wanted: number;
  /** What that range said when this block was recorded, for the diff. */
  readonly recorded: string;
  /** The issue tracking the block. */
  readonly issue: number;
};

/**
 * Recorded 2026-07-28, each against the newest published version at the time.
 * A block that clears is deleted from this list in the same change that takes
 * the bump — the list is the backlog, not a log.
 */
export const upstreamBlocks: readonly UpstreamBlock[] = [
  {
    dependency: "eslint",
    field: "peerDependencies",
    issue: 38,
    pkg: "eslint-plugin-react",
    recorded: "^3 || ^4 || ^5 || ^6 || ^7 || ^8 || ^9.7",
    summary:
      "eslint 10 — `eslint-plugin-react` breaks under it (`contextOrFilename.getFilename is not a function`) and reaches this repository transitively through `eslint-config-expo`, so no Dependabot pattern can ever match it",
    wanted: 10,
  },
  {
    dependency: "@jest/globals",
    field: "dependencies",
    issue: 38,
    pkg: "jest-expo",
    recorded: "^29.2.1",
    summary:
      "jest 30 — `jest-expo` is Expo-SDK-pinned and still depends on the Jest 29 runtime, so the mobile suite dies on `clearMocksOnScope`",
    wanted: 30,
  },
  {
    dependency: "@hono/node-server",
    field: "dependencies",
    issue: 23,
    pkg: "@modelcontextprotocol/sdk",
    recorded: "^1.19.9",
    summary:
      "the `@hono/node-server` advisory (GHSA-frvp-7c67-39w9, patched in 2.0.5) — the SDK caps it inside 1.x, and it reaches this repository through `shadcn`",
    wanted: 2,
  },
];

/**
 * Whether a range names a major at least this high.
 *
 * Deliberately not semver: `packages/tooling` may import nothing installed, and
 * the question is narrow enough to answer by reading the majors a range names.
 * `^9.7` names 9; `^3 || ... || ^9.7` names 3 through 9; `^1.19.9` names 1.
 * Patch churn inside a blocked major therefore does not fire, which is the
 * whole reason this is not a string comparison against `recorded`.
 *
 * The one shape it would misread is an exclusive upper bound — `<3` names 3
 * without allowing it. No upstream here uses one, and a false "unblocked"
 * costs a person one command to disprove, where a false "still blocked" would
 * cost the silence this sensor exists to end.
 */
export function namesMajorAtLeast(range: string, major: number): boolean {
  const majors = [...range.matchAll(/(?:^|[\s|,>=<~^])(\d+)/g)].map((match) =>
    Number(match[1]),
  );
  return majors.some((named) => named >= major);
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
      observed === undefined || namesMajorAtLeast(observed, block.wanted),
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
