import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { listTextFiles } from "./repository-files.ts";

const sourceRoot = path.join(import.meta.dirname);
const importPattern =
  /(?:^|\n)\s*(?:import|export)[^"'\n]*from\s+["']([^"']+)["']/g;

function importSpecifiers(file: string): string[] {
  const content = readFileSync(path.join(sourceRoot, file), "utf8");
  return [...content.matchAll(importPattern)].map((match) => match[1] ?? "");
}

const sources = listTextFiles(sourceRoot).filter(
  (file) => file.endsWith(".ts") && !file.endsWith(".test.ts"),
);

/**
 * `pnpm doctor` has to diagnose a checkout whose dependencies are missing or
 * broken, so nothing under `src` may import an installed package. This is the
 * mechanical guard for that rule; weakening it breaks the pre-install path.
 */
describe("repository tooling isolation", () => {
  it("finds the tooling sources", () => {
    expect(sources.length).toBeGreaterThan(10);
  });

  it.each(sources)(
    "%s imports only Node built-ins and local modules",
    (file) => {
      const external = importSpecifiers(file).filter(
        (specifier) =>
          !specifier.startsWith("node:") && !specifier.startsWith("."),
      );

      expect(external).toEqual([]);
    },
  );
});
