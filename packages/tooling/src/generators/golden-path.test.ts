import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { repositoryRoot } from "../repository.ts";
import { featureNames } from "./naming.ts";
import { renderTree } from "./render.ts";

/**
 * The example slice in this repository is generator output, and this is what
 * keeps it that way.
 *
 * It is the stage's exit gate made continuous: `pnpm verify` runs the whole
 * authoritative suite over the committed `announcement` slice, and this test
 * proves that slice is byte-for-byte what `pnpm generate feature announcement`
 * emits. A template that stops compiling, stops passing lint, or stops matching
 * Prettier fails a real check rather than waiting for the next person to run the
 * generator.
 *
 * Only the files the generator *creates* are compared. The registrations it
 * makes in shared files are covered by `feature-generator.test.ts`, which
 * applies them to a fixture checkout.
 */
describe("the committed example slice is generator output", () => {
  const names = featureNames("announcement");
  const rendered = new Map([
    ...renderTree("context", names),
    ...renderTree("feature", names),
  ]);

  it("emits the files the example is made of", () => {
    expect([...rendered.keys()].sort()).toEqual([
      "apps/mobile/src/app/(app)/announcements.tsx",
      "apps/mobile/src/components/announcements/announcement-board.tsx",
      "apps/mobile/src/components/announcements/announcement-panel.test.tsx",
      "apps/mobile/src/components/announcements/announcement-panel.tsx",
      "apps/mobile/src/components/announcements/announcement-rename-form.tsx",
      "apps/mobile/src/components/announcements/use-announcement-field-error.tsx",
      "apps/web/e2e/announcements.spec.ts",
      "apps/web/src/app/(app)/announcements/page.tsx",
      "apps/web/src/components/announcements/announcement-board.tsx",
      "apps/web/src/components/announcements/announcement-field-error.tsx",
      "apps/web/src/components/announcements/announcement-panel.test.tsx",
      "apps/web/src/components/announcements/announcement-panel.tsx",
      "apps/web/src/components/announcements/announcement-rename-form.tsx",
      "packages/api/src/routers/announcement.test.ts",
      "packages/api/src/routers/announcement.ts",
      "packages/db/src/announcement-repository.integration.test.ts",
      "packages/db/src/announcement-repository.ts",
      "packages/domain/src/announcement.test.ts",
      "packages/domain/src/announcement.ts",
    ]);
  });

  it.each([...rendered.keys()])("emits %s exactly as committed", (relative) => {
    const absolute = path.join(repositoryRoot, relative);
    expect(existsSync(absolute)).toBe(true);
    expect(readFileSync(absolute, "utf8")).toBe(rendered.get(relative));
  });
});
