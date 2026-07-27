import {
  deadLinks,
  externalLinks,
  formatDeadLinks,
  type LinkProbe,
} from "../external-links.ts";
import { repositoryRoot } from "../repository.ts";

const usage = `Usage: pnpm links:check

Requests every external link this repository's markdown points at and reports
the ones that are gone. Needs a network, so it is a scheduled sensor rather than
a step in \`pnpm verify\`: a link somebody else broke must never fail a pull
request that did not touch it.

Internal references are a different question with a different answer —
\`pnpm instructions\` proves those resolve, and that check does run in \`pnpm verify\`.`;

const requestTimeoutMs = 15_000;

/**
 * A HEAD request first, because most hosts answer it without sending a body —
 * and a GET after, because some answer HEAD with 405 or 404 while serving the
 * page perfectly well. Reporting the second answer is what keeps the sensor
 * from filing an issue about a host's opinion of HEAD.
 */
const probe: LinkProbe = async (url) => {
  for (const method of ["HEAD", "GET"] as const) {
    try {
      const response = await fetch(url, {
        method,
        redirect: "follow",
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
      if (response.ok || method === "GET") {
        return response.status;
      }
    } catch (error) {
      if (method === "GET") {
        return error instanceof Error ? error.message : String(error);
      }
    }
  }

  return "no response";
};

if (process.argv.includes("--help")) {
  console.log(usage);
} else {
  const links = externalLinks(repositoryRoot);
  console.log(`links: requesting ${String(links.length)} external link(s).`);

  const dead = await deadLinks(links, probe);

  if (dead.length === 0) {
    console.log(
      "links: every external link this repository points at answers.",
    );
  } else {
    console.error(formatDeadLinks(dead));
    console.error(
      `\nlinks: ${String(dead.length)} dead link(s). Point each at what replaced it, or remove it.`,
    );
    process.exitCode = 1;
  }
}
