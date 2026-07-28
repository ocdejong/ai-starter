import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { runCapture } from "../command.ts";
import { repositoryRoot } from "../repository.ts";
import {
  driftedRegions,
  featureRegistryEdits,
  featureRemovalEdits,
  generateContext,
  generateFeature,
  removeFeature,
} from "./feature.ts";
import { pinnedExampleSlices } from "./example-slices.ts";
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

  // Every file a generation or a removal touches, so the round trip below has
  // the pin to take the slice out of as well as the registries.
  for (const { file } of featureRemovalEdits) {
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
// company: `pressRelease` in code, "press release" in a sentence. And not a name
// the rehearsal generates: `fixtureCheckout` copies the *product's* catalogs, and
// the generator now defaults rather than assigns, so generating a feature the
// checkout already has would quietly assert against that feature's namespace
// instead of a fresh one — which is how this failed inside a rehearsed product
// while passing here.
const names = featureNames("press-release");

describe("generate feature", () => {
  let root: string;
  let created: readonly string[];
  let edited: readonly string[];
  let unchanged: readonly string[];
  let followUps: readonly string[];

  let englishBefore: string;

  beforeAll(() => {
    root = fixtureCheckout();
    englishBefore = read(root, "packages/i18n/messages/en.json");
    const result = generateFeature(root, names, "current");
    created = result.created;
    edited = result.edited;
    unchanged = result.unchanged;
    followUps = result.followUps;
  });

  it("writes the slice under the product's own words", () => {
    expect(created).toContain("packages/domain/src/press-release.ts");
    expect(created).toContain("packages/api/src/routers/press-release.ts");
    expect(created).toContain(
      "packages/db/src/press-release-repository.integration.test.ts",
    );
    expect(created).toContain("apps/web/src/app/(app)/press-releases/page.tsx");
    expect(created).toContain(
      "apps/mobile/src/components/press-releases/press-release-panel.tsx",
    );
    expect(created).toContain("apps/web/e2e/press-releases.spec.ts");
    expect(created).toHaveLength(19);
  });

  it("keeps identifiers and copy in their own forms", () => {
    const router = read(root, "packages/api/src/routers/press-release.ts");
    expect(router).toContain("export const pressReleaseRouter");
    expect(router).toContain("createPressReleaseInputSchema");
    expect(router).toContain("This group has no such press release.");
    expect(router).not.toContain("press-releaseRouter");
  });

  it("registers the slice everywhere it has to be registered", () => {
    // Every registry is visited and ends up correct. Asserting `edited` alone
    // would couple this to whether the checkout it copies from happens to carry
    // an in-progress generation already.
    expect([...edited, ...unchanged].sort()).toEqual(
      featureRegistryEdits.map(({ file }) => file).sort(),
    );

    expect(read(root, "packages/api/src/root.ts")).toContain(
      "pressRelease: pressReleaseRouter,",
    );
    expect(read(root, "packages/api/src/context.ts")).toContain(
      "pressReleases: PressReleaseRepository;",
    );
    expect(read(root, "apps/web/src/server/api/context.ts")).toContain(
      "createPrismaPressReleaseRepository(db)",
    );
    // A Prisma `///` comment documents the block below it, so a model inserted
    // between an existing comment and its model would quietly steal it.
    expect(read(root, "packages/db/prisma/schema.prisma")).toMatch(
      /stops every read and write\.\nmodel PressRelease \{/,
    );
    expect(read(root, "packages/db/prisma/schema.prisma")).toMatch(
      /stops every read and write\.\nmodel Announcement \{/,
    );
    expect(read(root, "apps/web/src/lib/routes.ts")).toContain(
      'export const pressReleasesPath = "/press-releases";',
    );
    expect(
      read(root, "apps/web/src/components/app-shell/app-shell.tsx"),
    ).toContain('href: pressReleasesPath, label: tNav("pressReleases")');
    // The marker the generator guards on, not the element it wrote: Prettier
    // wraps a three-attribute `Tabs.Screen` across lines, so the opening tag and
    // the name are only adjacent until something formats the file.
    expect(read(root, "apps/mobile/src/app/(app)/_layout.tsx")).toContain(
      'name="press-releases"',
    );
  });

  it("adds the same keys to both catalogs", () => {
    const english: unknown = JSON.parse(
      read(root, "packages/i18n/messages/en.json"),
    );
    // Loudly, rather than as a confusing key assertion: see the note on `names`.
    expect(
      englishBefore,
      "the checkout already had this feature, so nothing below is about a fresh one",
    ).not.toContain("pressReleases");
    const dutch: unknown = JSON.parse(
      read(root, "packages/i18n/messages/nl.json"),
    );

    const englishKeys = leafPaths(english).filter((key) =>
      key.startsWith("app.pressReleases."),
    );
    expect(englishKeys).toContain("app.pressReleases.current.title");
    expect(englishKeys).toContain(
      "app.pressReleases.validation.pressReleaseTitleRequired",
    );
    expect(
      leafPaths(dutch).filter((key) => key.startsWith("app.pressReleases.")),
    ).toEqual(englishKeys);

    // Copy has to survive a product's own noun being substituted into it.
    expect(read(root, "packages/i18n/messages/en.json")).toContain(
      "Current press release",
    );
    expect(read(root, "packages/i18n/messages/en.json")).not.toContain(
      "an press release",
    );
  });

  it("names the two things it cannot do itself", () => {
    expect(followUps.join("\n")).toContain(
      "pnpm db:migrate:dev --name add_pressReleases --create-only",
    );
    expect(followUps.join("\n")).toContain("packages/i18n/messages/nl.json");
  });

  // The migration is the one follow-up whose output another gate judges: without
  // both timeouts and with a `varchar(n)` title, `pnpm db:lint` rejects the file
  // Prisma wrote. So the SQL is dictated rather than described, and the
  // rehearsal applies the same text a reader is told to paste.
  it("dictates the SQL the migration needs and Prisma cannot write", () => {
    const printed = followUps.join("\n");

    expect(printed).toContain("set lock_timeout = '1s';");
    expect(printed).toContain("set statement_timeout = '5s';");
    expect(printed).toContain(
      'CREATE UNIQUE INDEX "PressRelease_groupId_current_key" ON "PressRelease"("groupId") WHERE "isCurrent";',
    );
    expect(printed).toContain('"PressRelease_title_length_check"');
  });

  // The budget is explicit because this case spawns a subprocess, like every
  // other one in this package that does (`knip.test.ts`, `rules.test.ts`, the
  // depcruise cases). A single `pnpm exec prettier` was measured between 0.7s
  // and 3.2s on an otherwise idle machine, and it runs here beside two other
  // test suites under `turbo` — so the default 5s budget is one slow spawn from
  // failing, which is how it failed inside a freshly instantiated product while
  // passing in this repository. The assertion is about idempotency, not speed.
  it("changes nothing when it runs a second time", { timeout: 60_000 }, () => {
    // The command formats what it wrote, so by the second run every inserted
    // line may have been rewrapped. Reproducing that here is what catches a
    // guard that compares the text it inserted rather than something Prettier
    // cannot reflow — the bug that put two identical tabs in the layout.
    // Run from the repository, on absolute paths: `pnpm exec` finds nothing in
    // a bare temporary directory, and a silently skipped format would make this
    // test pass without reproducing anything.
    const formatted = runCapture(
      "pnpm",
      [
        "exec",
        "prettier",
        "--write",
        "--log-level",
        "silent",
        ...featureRegistryEdits
          .filter(({ file }) => !file.endsWith(".prisma"))
          .map(({ file }) => path.join(root, file)),
      ],
      { cwd: repositoryRoot },
    );
    expect(formatted.code).toBe(0);
    const before = featureRegistryEdits.map(({ file }) => read(root, file));

    const second = generateFeature(root, names, "current");

    expect(second.created).toEqual([]);
    expect(second.edited).toEqual([]);
    expect(second.skipped).toHaveLength(19);
    expect(second.unchanged).toHaveLength(featureRegistryEdits.length);
    expect(featureRegistryEdits.map(({ file }) => read(root, file))).toEqual(
      before,
    );
  });
});

/**
 * The shape is the stage-17 finding made executable.
 *
 * A cold agent given "households organise chores" replaced the generated model
 * and kept the generated copy, shipping a chore board that talked about
 * publishing. Everything passed — both catalogs were in parity and every key was
 * typed — so the only way to catch it is to stop emitting that copy for a
 * product that never asked for it.
 *
 * This is the replay of exactly that case: a chore board, generated the way that
 * agent would generate one now.
 */
describe("generate feature --shape list", () => {
  let root: string;
  let created: readonly string[];
  let followUps: readonly string[];

  const chores = featureNames("chore");

  beforeAll(() => {
    root = fixtureCheckout();
    const result = generateFeature(root, chores, "list");
    created = result.created;
    followUps = result.followUps;
  });

  it("writes the same slice, with no record singled out as current", () => {
    expect(created).toHaveLength(19);
    expect(created.map((file) => read(root, file)).join("\n")).not.toContain(
      "isCurrent",
    );
  });

  // Scoped to what this feature contributed: the fixture is built from the real
  // repository, so it carries the committed `announcement` registrations too —
  // and those are a `current` slice, correctly.
  it("registers a port and a model that have no current record either", () => {
    const port =
      /export type ChoreRecord[\s\S]*?export type ChoreRepository[\s\S]*?\n}>;/.exec(
        read(root, "packages/api/src/context.ts"),
      );
    const model = /model Chore \{[\s\S]*?\n}/.exec(
      read(root, "packages/db/prisma/schema.prisma"),
    );

    expect(port?.[0]).toBeDefined();
    expect(port?.[0]).not.toContain("isCurrent");
    expect(model?.[0]).toBeDefined();
    expect(model?.[0]).not.toContain("isCurrent");
  });

  it("says nothing about superseding, in either catalog", () => {
    for (const locale of ["en", "nl"]) {
      const catalog = read(root, `packages/i18n/messages/${locale}.json`);
      const namespace: unknown = JSON.parse(catalog);
      const copy = JSON.stringify(
        leafPaths(namespace)
          .filter((key) => key.startsWith("app.chores."))
          .map((key) =>
            key
              .split(".")
              .reduce<unknown>(
                (value, part) =>
                  typeof value === "object" && value !== null
                    ? (value as Record<string, unknown>)[part]
                    : undefined,
                namespace,
              ),
          ),
      );

      expect(copy).not.toMatch(/supersed|[Pp]ublish/);
      expect(copy).toContain("Add");
    }
  });

  it("drops the partial unique index and keeps the bound the title needs", () => {
    const printed = followUps.join("\n");

    expect(printed).not.toContain("CREATE UNIQUE INDEX");
    expect(printed).toContain('"Chore_title_length_check"');
    expect(printed).toContain("set lock_timeout = '1s';");
    expect(printed).toContain("set statement_timeout = '5s';");
  });
});

/**
 * A re-run must not put English back over somebody's translation.
 *
 * `press-release` cannot catch this class: it is generated fresh, so every string
 * a re-run writes is a string the previous run wrote. Only a catalog somebody
 * has since translated can tell an assignment from a default.
 *
 * The first case plants that translation itself, so it holds in a product that
 * has removed the example. The second is the same claim about the slice this
 * repository actually ships — which is `announcement` here and nothing at all in
 * a product that removed it, so it is driven off the pin rather than the noun.
 */
describe("a re-run over a feature somebody has since translated", () => {
  it("leaves the translated copy alone", () => {
    const root = fixtureCheckout();
    const invoices = featureNames("invoice");
    const dutch = "packages/i18n/messages/nl.json";

    generateFeature(root, invoices, "current");
    const translated = read(root, dutch)
      .replace('"invoices": "Invoices"', '"invoices": "Facturen"')
      .replace('"title": "Invoices"', '"title": "Facturen"');
    writeFileSync(path.join(root, dutch), translated);

    generateFeature(root, invoices, "current");

    expect(read(root, dutch)).toBe(translated);
    expect(read(root, dutch)).toContain("Facturen");
  });

  it.each(pinnedExampleSlices)(
    "leaves $name's hand-written Dutch alone",
    ({ name, shape }) => {
      const root = fixtureCheckout();
      const dutch = () => read(root, "packages/i18n/messages/nl.json");
      const before = dutch();

      generateFeature(root, featureNames(name), shape);

      expect(dutch()).toBe(before);
    },
  );
});

describe("generate context", () => {
  it("writes the domain half and exports it, and nothing else", () => {
    const root = fixtureCheckout();

    const result = generateContext(root, featureNames("billing-period"));

    expect([...result.created].sort()).toEqual([
      "packages/domain/src/billing-period.test.ts",
      "packages/domain/src/billing-period.ts",
    ]);
    expect([...result.edited, ...result.unchanged]).toEqual([
      "packages/domain/src/index.ts",
    ]);
    expect(read(root, "packages/domain/src/index.ts")).toContain(
      'from "./billing-period";',
    );
  });
});

/**
 * Removal proven the only way that means anything: a round trip.
 *
 * Enumerating what each reversal should have deleted would test the reversals
 * against my reading of them. Generating a slice into a checkout, formatting it
 * the way the command does, taking it out again and demanding the files are
 * byte-identical to what they were tests them against the edits themselves — and
 * every registry is covered by construction, including any added later.
 *
 * The format step is load-bearing. A product removes a slice long after Prettier
 * has rewrapped what the generator inserted, so a reversal that only matches its
 * own unformatted output would work here and fail there.
 */
describe.each(["current", "list"] as const)(
  "generate feature --remove, after --shape %s",
  (shape) => {
    it(
      "puts every registry back exactly as it found it",
      { timeout: 120_000 },
      () => {
        const root = fixtureCheckout();
        const invoices = featureNames("invoice");
        const before = featureRegistryEdits.map(({ file }) => read(root, file));

        const format = () => {
          const run = runCapture(
            "pnpm",
            [
              "exec",
              "prettier",
              "--write",
              "--log-level",
              "silent",
              ...featureRegistryEdits
                .filter(({ file }) => !file.endsWith(".prisma"))
                .map(({ file }) => path.join(root, file)),
            ],
            { cwd: repositoryRoot },
          );
          expect(run.code).toBe(0);
        };

        generateFeature(root, invoices, shape);
        format();

        const result = removeFeature(root, invoices);
        // Both commands format what they touched, so both sides of the round
        // trip are compared in the shape Prettier leaves them.
        format();

        expect(result.removed).toHaveLength(19);
        expect(result.absent).toEqual([]);
        expect(
          featureRegistryEdits.map(({ file }) => read(root, file)),
        ).toEqual(before);
      },
    );

    // The case that decides whether a product can remove the *example*: its pin
    // has to go with it, or `golden-path.test.ts` is left holding a slice that
    // is not there — which would be the hand edit the constraint forbids.
    // The pin is planted rather than read from this repository: a product that
    // has already removed the example has an empty one, and a case that assumed
    // otherwise would fail there for a reason about this repository.
    const pin = "packages/tooling/src/generators/example-slices.ts";
    const plantPin = (root: string, name: string) => {
      writeFileSync(
        path.join(root, pin),
        read(root, pin).replace(
          "= [",
          `= [\n  { name: "${name}", shape: "current" },`,
        ),
      );
    };

    it("takes a pinned slice off the pin", () => {
      const root = fixtureCheckout();
      plantPin(root, "invoice");
      generateFeature(root, featureNames("invoice"), shape);

      const result = removeFeature(root, featureNames("invoice"));

      expect(result.edited).toContain(pin);
      expect(read(root, pin)).not.toContain('{ name: "invoice"');
    });

    it("leaves a pin that never named the slice alone", () => {
      const root = fixtureCheckout();
      plantPin(root, "ledger-entry");
      generateFeature(root, featureNames("invoice"), shape);

      const result = removeFeature(root, featureNames("invoice"));

      expect(result.unchanged).toContain(pin);
      expect(read(root, pin)).toContain('{ name: "ledger-entry"');
    });

    // Stage 13 hit this twice and could not explain it: Next's generated route
    // types outlive the route, so the next `pnpm typecheck` fails on a module
    // nobody wrote. The rehearsal's inverse leg reproduced it exactly.
    it("takes Next's stale route types with the route", () => {
      const root = fixtureCheckout();
      const invoices = featureNames("invoice");
      generateFeature(root, invoices, shape);
      const stale = path.join(root, "apps/web/.next/types/app/(app)/invoices");
      mkdirSync(stale, { recursive: true });
      writeFileSync(path.join(stale, "page.ts"), "export {};\n");

      removeFeature(root, invoices);

      expect(existsSync(path.join(root, "apps/web/.next"))).toBe(false);
    });

    it("names the drop migration as the thing it cannot do", () => {
      const root = fixtureCheckout();
      const invoices = featureNames("invoice");
      generateFeature(root, invoices, shape);

      const printed = removeFeature(root, invoices).followUps.join("\n");

      expect(printed).toContain('DROP TABLE "Invoice";');
      expect(printed).toContain("cannot be edited or deleted");
    });
  },
);

/**
 * The drift the pin exists for, planted.
 *
 * Rewording a registered block leaves every other check green: it still
 * compiles, it still passes lint and Prettier, and re-running the generator
 * still reports the registration as present — the helpers guard on a marker that
 * answers "is this feature registered", not "does it still say this". That is
 * how the committed port declaration drifted three sentences from the generator
 * and survived every `pnpm verify` since stage 13.
 */
describe("a registration region that has drifted", () => {
  it("is reported, where re-running the generator reports nothing", () => {
    const root = fixtureCheckout();
    const invoices = featureNames("invoice");
    generateFeature(root, invoices, "current");
    const file = "packages/api/src/context.ts";

    expect(driftedRegions(root, invoices, "current")).toEqual([]);

    // Worded so it can only match the invoice's own block: the committed
    // announcement port is in this file too, and every sentence they share
    // would otherwise be reworded in the wrong one.
    writeFileSync(
      path.join(root, file),
      read(root, file).replace(
        "The invoice reads and writes this layer needs",
        "The invoice reads and writes this layer wants",
      ),
    );

    expect(driftedRegions(root, invoices, "current")).toEqual([file]);
    // And the thing that used to be the only guard still sees nothing wrong.
    expect(generateFeature(root, invoices, "current").edited).toEqual([]);
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

    expect(() =>
      generateFeature(root, featureNames("invoice"), "current"),
    ).toThrow(AnchorMissingError);
    try {
      generateFeature(root, featureNames("invoice"), "current");
    } catch (thrown) {
      expect((thrown as Error).message).toContain(shell);
      expect((thrown as Error).message).toContain("by hand");
    }
  });
});
