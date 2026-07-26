import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { repositoryRoot } from "../repository.ts";
import {
  featureRegistryEdits,
  generateContext,
  generateFeature,
} from "./feature.ts";
import { featureNames } from "./naming.ts";
import { AnchorMissingError } from "./source-edits.ts";

/**
 * Copies the repository's real registry files into a throwaway checkout.
 *
 * Using the real files rather than stubs is the point: an anchor this generator
 * depends on is only proven to exist if the thing being edited is the file that
 * actually ships. A refactor that moves one fails here.
 */
function fixtureCheckout(): string {
  const root = mkdtempSync(path.join(tmpdir(), "generate-feature-"));

  for (const { file } of featureRegistryEdits) {
    const destination = path.join(root, file);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(
      destination,
      readFileSync(path.join(repositoryRoot, file), "utf8"),
    );
  }

  return root;
}

const read = (root: string, file: string) =>
  readFileSync(path.join(root, file), "utf8");

const leafPaths = (value: unknown, prefix = ""): string[] =>
  typeof value === "object" && value !== null
    ? Object.entries(value).flatMap(([key, nested]) =>
        leafPaths(nested, `${prefix}${key}.`),
      )
    : [prefix.slice(0, -1)];

// A two-word name, because that is where identifier forms and copy forms part
// company: `releaseNote` in code, "release note" in a sentence.
const names = featureNames("release-note");

describe("generate feature", () => {
  let root: string;
  let created: readonly string[];
  let edited: readonly string[];
  let followUps: readonly string[];

  beforeAll(() => {
    root = fixtureCheckout();
    const result = generateFeature(root, names);
    created = result.created;
    edited = result.edited;
    followUps = result.followUps;
  });

  it("writes the slice under the product's own words", () => {
    expect(created).toContain("packages/domain/src/release-note.ts");
    expect(created).toContain("packages/api/src/routers/release-note.ts");
    expect(created).toContain(
      "packages/db/src/release-note-repository.integration.test.ts",
    );
    expect(created).toContain("apps/web/src/app/(app)/release-notes/page.tsx");
    expect(created).toContain(
      "apps/mobile/src/components/release-notes/release-note-panel.tsx",
    );
    expect(created).toContain("apps/web/e2e/release-notes.spec.ts");
    expect(created).toHaveLength(19);
  });

  it("keeps identifiers and copy in their own forms", () => {
    const router = read(root, "packages/api/src/routers/release-note.ts");
    expect(router).toContain("export const releaseNoteRouter");
    expect(router).toContain("publishReleaseNoteInputSchema");
    expect(router).toContain("This group has no such release note.");
    expect(router).not.toContain("release-noteRouter");
  });

  it("registers the slice everywhere it has to be registered", () => {
    expect([...edited].sort()).toEqual(
      featureRegistryEdits.map(({ file }) => file).sort(),
    );

    expect(read(root, "packages/api/src/root.ts")).toContain(
      "releaseNote: releaseNoteRouter,",
    );
    expect(read(root, "packages/api/src/context.ts")).toContain(
      "releaseNotes: ReleaseNoteRepository;",
    );
    expect(read(root, "apps/web/src/server/api/context.ts")).toContain(
      "createPrismaReleaseNoteRepository(db)",
    );
    expect(read(root, "packages/db/prisma/schema.prisma")).toContain(
      "model ReleaseNote {",
    );
    expect(read(root, "apps/web/src/lib/routes.ts")).toContain(
      'export const releaseNotesPath = "/release-notes";',
    );
    expect(
      read(root, "apps/web/src/components/app-shell/app-shell.tsx"),
    ).toContain('href: releaseNotesPath, label: tNav("releaseNotes")');
    expect(read(root, "apps/mobile/src/app/(app)/_layout.tsx")).toContain(
      '<Tabs.Screen name="release-notes"',
    );
  });

  it("adds the same keys to both catalogs", () => {
    const english: unknown = JSON.parse(
      read(root, "packages/i18n/messages/en.json"),
    );
    const dutch: unknown = JSON.parse(
      read(root, "packages/i18n/messages/nl.json"),
    );

    const englishKeys = leafPaths(english).filter((key) =>
      key.startsWith("app.releaseNotes."),
    );
    expect(englishKeys).toContain("app.releaseNotes.current.title");
    expect(englishKeys).toContain(
      "app.releaseNotes.validation.releaseNoteTitleRequired",
    );
    expect(
      leafPaths(dutch).filter((key) => key.startsWith("app.releaseNotes.")),
    ).toEqual(englishKeys);

    // Copy has to survive a product's own noun being substituted into it.
    expect(read(root, "packages/i18n/messages/en.json")).toContain(
      "Current release note",
    );
    expect(read(root, "packages/i18n/messages/en.json")).not.toContain(
      "an release note",
    );
  });

  it("names the two things it cannot do itself", () => {
    expect(followUps.join("\n")).toContain(
      "pnpm db:migrate:dev --name add_releaseNotes --create-only",
    );
    expect(followUps.join("\n")).toContain("packages/i18n/messages/nl.json");
  });

  it("changes nothing when it runs a second time", () => {
    const before = featureRegistryEdits.map(({ file }) => read(root, file));

    const second = generateFeature(root, names);

    expect(second.created).toEqual([]);
    expect(second.edited).toEqual([]);
    expect(second.skipped).toHaveLength(19);
    expect(second.unchanged).toHaveLength(featureRegistryEdits.length);
    expect(featureRegistryEdits.map(({ file }) => read(root, file))).toEqual(
      before,
    );
  });
});

describe("generate context", () => {
  it("writes the domain half and exports it, and nothing else", () => {
    const root = fixtureCheckout();

    const result = generateContext(root, featureNames("billing-period"));

    expect([...result.created].sort()).toEqual([
      "packages/domain/src/billing-period.test.ts",
      "packages/domain/src/billing-period.ts",
    ]);
    expect(result.edited).toEqual(["packages/domain/src/index.ts"]);
    expect(read(root, "packages/domain/src/index.ts")).toContain(
      'from "./billing-period";',
    );
  });
});

describe("a registry that has moved", () => {
  it("names the file and the edit instead of skipping it", () => {
    const root = fixtureCheckout();
    const shell = "apps/web/src/components/app-shell/app-shell.tsx";
    writeFileSync(
      path.join(root, shell),
      read(root, shell).replace(
        "// A generated feature registers its section on the line below.",
        "",
      ),
    );

    expect(() => generateFeature(root, featureNames("invoice"))).toThrow(
      AnchorMissingError,
    );
    try {
      generateFeature(root, featureNames("invoice"));
    } catch (thrown) {
      expect((thrown as Error).message).toContain(shell);
      expect((thrown as Error).message).toContain("by hand");
    }
  });
});
