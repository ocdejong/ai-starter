import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { repositoryRoot } from "../repository.ts";
import { pinnedExampleSlices } from "./example-slices.ts";
import { driftedRegions, featureTree } from "./feature.ts";
import { featureNames } from "./naming.ts";
import { renderTree } from "./render.ts";

/**
 * The example slice in this repository is generator output, and this is what
 * keeps it that way.
 *
 * It is the stage's exit gate made continuous: `pnpm verify` runs the whole
 * authoritative suite over the committed `announcement` slice, and this test
 * proves that slice is byte-for-byte what `pnpm generate feature announcement
 * --shape current` emits. A template that stops compiling, stops passing lint,
 * or stops matching Prettier fails a real check rather than waiting for the next
 * person to run the generator.
 *
 * It loops rather than using `it.each` because `pinnedExampleSlices` may be
 * empty: that is exactly the state of a product that ran
 * `pnpm generate feature --remove announcement`, and a parameterised suite with
 * no cases is a failure rather than a pass.
 */
describe("the committed example slices are generator output", () => {
  it("emits every pinned slice exactly as committed", () => {
    for (const slice of pinnedExampleSlices) {
      const names = featureNames(slice.name);
      const rendered = new Map([
        ...renderTree("context", names),
        ...featureTree(names, slice.shape),
      ]);

      expect(rendered.size).toBe(19);

      for (const [relative, contents] of rendered) {
        const absolute = path.join(repositoryRoot, relative);
        expect(
          existsSync(absolute),
          `${relative} is pinned as generator output and is not there.`,
        ).toBe(true);
        expect(readFileSync(absolute, "utf8"), relative).toBe(contents);
      }
    }
  });

  /**
   * The other half of the pin, and the half that was missing.
   *
   * `packages/api/src/context.ts` carried a port declaration three sentences
   * different from the one the generator emits, through every `pnpm verify`
   * since stage 13. Nothing could have caught it: the registration helpers guard
   * on a marker that answers "is this feature registered", which stays true
   * however the block is worded. So this compares the text.
   */
  it("leaves every shared file saying what the generator would say", () => {
    for (const slice of pinnedExampleSlices) {
      expect(
        driftedRegions(repositoryRoot, featureNames(slice.name), slice.shape),
        `${slice.name}'s registrations`,
      ).toEqual([]);
    }
  });
});
