import { describe, expect, it } from "vitest";

import { addFeatureNamespace } from "./catalog-edits.ts";
import { featureNames } from "./naming.ts";

/**
 * Re-running a generator over a slice that already exists is a documented path —
 * `README.md` names `pnpm generate feature announcement` as the way to put the
 * example back — so every write it makes has to leave existing copy alone.
 *
 * The namespace always did. The navigation label did not, and the gap was
 * invisible to the generator's own idempotency test for the reason that makes
 * this class of bug hard to see: that fixture is untranslated, so overwriting
 * Dutch with English is a no-op there. Only a translated fixture can fail on it.
 */
describe("addFeatureNamespace", () => {
  const names = featureNames("release-note");

  function serialise(catalog: unknown): string {
    return `${JSON.stringify(catalog, null, 2)}\n`;
  }

  const empty = serialise({ app: { nav: { dashboard: "Dashboard" } } });

  /** The catalog a translator leaves behind: label and namespace both Dutch. */
  function translated(): string {
    const parsed = JSON.parse(addFeatureNamespace(empty, names)) as {
      app: {
        nav: Record<string, string>;
        releaseNotes: Record<string, unknown>;
      };
    };

    parsed.app.nav.releaseNotes = "Releasenotities";
    parsed.app.releaseNotes.title = "Releasenotities";

    return serialise(parsed);
  }

  it("writes the namespace and its navigation label into a fresh catalog", () => {
    const parsed = JSON.parse(addFeatureNamespace(empty, names)) as {
      app: { nav: Record<string, string>; releaseNotes: { title: string } };
    };

    expect(parsed.app.nav.releaseNotes).toBe("Release notes");
    expect(parsed.app.releaseNotes.title).toBe("Release notes");
  });

  it("leaves a translated navigation label and namespace untouched", () => {
    const dutch = translated();

    expect(addFeatureNamespace(dutch, names)).toBe(dutch);
  });
});
