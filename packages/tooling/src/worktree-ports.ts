import { statSync } from "node:fs";
import path from "node:path";

/**
 * Deterministic per-checkout port derivation. `findFreePort` alone cannot keep
 * sibling worktrees apart: a probe only sees ports something is listening on
 * right now, so two bootstraps racing — or one running while a neighbour's
 * container is stopped — both pick the example's first free port and end up
 * sharing one database. Deriving the preferred port from the worktree's own
 * path gives every worktree a distinct default without any coordination.
 */

/** How many distinct offsets exist; derived ports span (base, base + spread]. */
export const worktreePortSpread = 200;

/**
 * A linked worktree marks its root with a `.git` *file* naming the real git
 * directory; a primary checkout has a `.git` directory. Only linked worktrees
 * derive ports — a primary checkout keeps the example's friendly defaults.
 */
export function isLinkedWorktree(root: string): boolean {
  try {
    return statSync(path.join(root, ".git")).isFile();
  } catch {
    return false;
  }
}

/**
 * Hashes the absolute root path (FNV-1a) into [1, worktreePortSpread]. The
 * same worktree derives the same offset on every run, so a re-bootstrap finds
 * its own container again; two worktrees agree only on a hash collision,
 * which the free-port probe then resolves.
 */
export function worktreePortOffset(root: string): number {
  let hash = 0x811c9dc5;
  for (const character of path.resolve(root)) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return (hash % worktreePortSpread) + 1;
}

/**
 * Moves the example web origin's port by the worktree's offset. Returns
 * undefined when the example does not name a URL with an explicit port, so a
 * product whose example lacks one simply keeps its example value.
 */
export function deriveWebOrigin(
  exampleUrl: string | undefined,
  offset: number,
): string | undefined {
  if (exampleUrl === undefined || exampleUrl === "") {
    return undefined;
  }

  let url: URL;
  try {
    url = new URL(exampleUrl);
  } catch {
    return undefined;
  }

  if (url.port === "") {
    return undefined;
  }

  url.port = String(Number(url.port) + offset);
  return url.origin;
}
