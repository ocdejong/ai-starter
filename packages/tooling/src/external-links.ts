import { readFileSync } from "node:fs";
import path from "node:path";

import { listFiles } from "./repository-files.ts";

/**
 * The links this repository makes to the world outside it.
 *
 * `pnpm instructions` already proves every *internal* reference resolves, and it
 * runs inside `pnpm verify` because a checkout can answer that question by
 * itself. An external link cannot be checked without a network, and it rots on
 * somebody else's schedule — a vendor reorganises its documentation and a
 * research citation quietly starts 404-ing. So this is a scheduled sensor rather
 * than a gate: it must never be able to fail a pull request that did not touch
 * it.
 */

export type ExternalLink = {
  readonly url: string;
  /** Repository-relative file the link is written in. */
  readonly file: string;
};

export type DeadLink = ExternalLink & {
  /** HTTP status, or the transport error when the request never completed. */
  readonly reason: string;
};

const markdownLink = /\[[^\]\n]*\]\((https?:\/\/[^)\s]+)\)/g;
const bareUrl = /<(https?:\/\/[^>\s]+)>/g;

/**
 * A localhost URL is an instruction to the reader, not a destination; checking
 * it would report whatever happens to be listening on the machine that ran the
 * sensor.
 */
function isCheckable(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname !== "localhost" && hostname !== "127.0.0.1";
  } catch {
    return false;
  }
}

/** Every distinct external link in the repository's markdown, in file order. */
export function externalLinks(root: string): ExternalLink[] {
  const seen = new Set<string>();
  const links: ExternalLink[] = [];

  for (const file of listFiles(root).filter((entry) => entry.endsWith(".md"))) {
    const content = readFileSync(path.join(root, file), "utf8");

    for (const pattern of [markdownLink, bareUrl]) {
      for (const [, url] of content.matchAll(pattern)) {
        const trimmed = url?.replace(/[.,)]+$/, "") ?? "";
        if (!isCheckable(trimmed) || seen.has(trimmed)) {
          continue;
        }
        seen.add(trimmed);
        links.push({ file, url: trimmed });
      }
    }
  }

  return links;
}

export type LinkProbe = (url: string) => Promise<number | string>;

/**
 * Reports the links that answered with a failure.
 *
 * A redirect, a 401 and a 403 all count as alive: the destination exists and
 * the sensor is not authorised to read it, which is a fact about the sensor. A
 * bot-hostile host answering 429 is the same shape. Only a 404, a 410, a server
 * error, or a request that never completed says the link is dead.
 */
export async function deadLinks(
  links: readonly ExternalLink[],
  probe: LinkProbe,
): Promise<DeadLink[]> {
  const dead: DeadLink[] = [];

  for (const link of links) {
    const outcome = await probe(link.url);
    if (typeof outcome === "string") {
      dead.push({ ...link, reason: outcome });
      continue;
    }
    if (outcome === 404 || outcome === 410 || outcome >= 500) {
      dead.push({ ...link, reason: `HTTP ${String(outcome)}` });
    }
  }

  return dead;
}

export function formatDeadLinks(dead: readonly DeadLink[]): string {
  return dead
    .map((link) => `FAIL  ${link.file}: ${link.url} — ${link.reason}`)
    .join("\n");
}
