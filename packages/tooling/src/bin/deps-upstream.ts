import {
  formatReviews,
  reviewBlock,
  type BlockReview,
  type Manifest,
  upstreamBlocks,
} from "../upstream-blocks.ts";

const usage = `Usage: pnpm deps:upstream

Asks whether the upstream releases this repository is waiting on have landed.

Some declines have no local trigger. A Dependabot group re-proposes eslint 10
and jest 30 every week, each fails for a reason nothing here can fix, and each
is closed again — and the day the upstream release lands, nothing in this
repository notices. \`upstream-blocks.ts\` records each of those, and this reads
the upstream manifests and fails when one stops saying what is recorded.

The red means the recorded list is stale, which is why it fits the same failure
semantics as the other sensors rather than inverting them.

A scheduled sensor rather than a step in \`pnpm verify\`: its answer depends on
somebody else's registry, and a check no commit can turn green must never be
able to block one.

Reads the public npm registry and needs no credentials. When the registry
cannot be reached it says so and exits 0 — an outage somewhere else is not a
finding about this repository.`;

const registry = "https://registry.npmjs.org";

if (process.argv.includes("--help")) {
  console.log(usage);
} else {
  process.exitCode = await main();
}

async function main(): Promise<number> {
  const reviews: BlockReview[] = [];

  for (const block of upstreamBlocks) {
    const manifest = await readManifest(block.pkg);
    if (manifest === undefined) {
      console.log(
        `upstream: could not read ${block.pkg} from the registry — skipping. Nothing about this repository has been checked.`,
      );
      return 0;
    }
    reviews.push(reviewBlock(block, manifest));
  }

  console.log(formatReviews(reviews));
  return reviews.some((review) => review.cleared) ? 1 : 0;
}

/** The registry's `latest` document, or undefined when it cannot be read. */
async function readManifest(pkg: string): Promise<Manifest | undefined> {
  try {
    const response = await fetch(
      `${registry}/${encodeURIComponent(pkg)}/latest`,
      { headers: { accept: "application/json" } },
    );
    if (!response.ok) {
      return undefined;
    }
    return asManifest(await response.json());
  } catch {
    return undefined;
  }
}

/**
 * Narrows the registry's answer by hand. `packages/tooling` may not import Zod
 * — Node built-ins only — so the boundary is checked here rather than trusted,
 * which is the same discipline `repository-host-apply.ts` uses.
 */
function asManifest(value: unknown): Manifest | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const version = record.version;
  if (typeof version !== "string") {
    return undefined;
  }
  const dependencies = asRanges(record.dependencies);
  const peerDependencies = asRanges(record.peerDependencies);
  // Spread rather than assign: under `exactOptionalPropertyTypes` an optional
  // property means "absent", and writing `undefined` into it is a different
  // claim the compiler is right to reject.
  return {
    ...(dependencies === undefined ? {} : { dependencies }),
    ...(peerDependencies === undefined ? {} : { peerDependencies }),
    version,
  };
}

function asRanges(value: unknown): Record<string, string> | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const ranges: Record<string, string> = {};
  for (const [name, range] of Object.entries(value)) {
    if (typeof range === "string") {
      ranges[name] = range;
    }
  }
  return ranges;
}
