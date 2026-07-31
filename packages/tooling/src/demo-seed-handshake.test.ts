import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { repositoryRoot } from "./repository.ts";

/**
 * `pnpm db:seed` proves the target database is local and then tells the runtime
 * half so, and the runtime half refuses without it. The two sides cannot share
 * a constant — this package may import nothing installed, and the seed lives
 * behind `@ai-starter/auth` — so they carry the same two literals instead.
 *
 * Nothing else would notice them drifting apart. The failure that follows is
 * quiet in the worst way: renaming either one leaves `pnpm db:seed` refusing
 * its own request, and the message blames the caller for skipping a wrapper
 * they used.
 */
function read(relative: string): string {
  return readFileSync(path.join(repositoryRoot, relative), "utf8");
}

describe("the demo seed's local-check handshake", () => {
  const plan = read("packages/auth/src/demo-seed-plan.ts");
  const wrapper = read("packages/tooling/src/bin/db-seed.ts");

  it("sends the variable the runtime half reads", () => {
    const required = /localSeedAcknowledgementVariable\s*=\s*"([A-Z_]+)"/.exec(
      plan,
    )?.[1];

    expect(required).toBeDefined();
    expect(wrapper).toContain(required);
  });

  it("sends the value the runtime half demands", () => {
    const required = /localSeedAcknowledgement\s*=\s*"([a-z-]+)"/.exec(
      plan,
    )?.[1];

    expect(required).toBeDefined();
    expect(wrapper).toContain(`"${required}"`);
  });
});
