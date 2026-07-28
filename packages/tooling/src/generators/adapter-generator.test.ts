import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { repositoryRoot } from "../repository.ts";
import { adapterRegistryEdits, generateAdapter } from "./feature.ts";
import { featureNames, type FeatureNames } from "./naming.ts";

/**
 * The same precondition `feature-generator.test.ts` states, for the same reason.
 *
 * This copies the *product's* re-export barrel, and generation is idempotent, so
 * an adapter the checkout already has would leave the barrel untouched and every
 * assertion below would read somebody else's registration. It is the noun the
 * rehearsal generates, which makes a rehearsed product exactly where it would
 * bite — and where `release-note` and `chore` both bit before.
 */
function fixtureCheckout(names: FeatureNames): string {
  const root = mkdtempSync(path.join(tmpdir(), "generate-adapter-"));

  for (const { file } of adapterRegistryEdits) {
    const destination = path.join(root, file);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(
      destination,
      readFileSync(path.join(repositoryRoot, file), "utf8"),
    );
  }

  const barrel = "packages/api/src/index.ts";
  if (
    readFileSync(path.join(root, barrel), "utf8").includes(
      `from "./${names.kebab}";`,
    )
  ) {
    throw new Error(
      `This checkout already exports an adapter called "${names.kebab}" from ` +
        `${barrel}. Generating it again changes nothing, so the assertions ` +
        `would read that adapter instead of freshly generated output. Pick a ` +
        `noun this repository does not ship.`,
    );
  }

  return root;
}

const names = featureNames("shipping-carrier");

describe("generate adapter", () => {
  const root = fixtureCheckout(names);
  const result = generateAdapter(root, names);
  const read = (file: string) => readFileSync(path.join(root, file), "utf8");

  it("puts the port in the API layer and the adapter at the composition root", () => {
    expect([...result.created].sort()).toEqual([
      "apps/web/src/server/shipping-carrier/client.test.ts",
      "apps/web/src/server/shipping-carrier/client.ts",
      "packages/api/src/shipping-carrier.test.ts",
      "packages/api/src/shipping-carrier.ts",
    ]);
    expect([...result.edited, ...result.unchanged]).toEqual([
      "packages/api/src/index.ts",
    ]);
    expect(read("packages/api/src/index.ts")).toContain(
      'from "./shipping-carrier";',
    );
  });

  it("names no vendor", () => {
    const client = read("apps/web/src/server/shipping-carrier/client.ts");

    // The generator cannot know which provider this will be, and a template that
    // guessed would be a dependency nobody chose.
    expect(client).not.toMatch(/stripe|resend|twilio|sendgrid/i);
    expect(client).toContain("createShippingCarrierClient");
  });

  it("carries the four things an adapter owes its caller", () => {
    const client = read("apps/web/src/server/shipping-carrier/client.ts");

    expect(client).toContain("AbortSignal.timeout(timeoutMs)");
    expect(client).toContain("referenceResponseSchema.safeParse(body)");
    expect(client).toContain("ShippingCarrierFailure");
    expect(client).toContain("redact(thrown.message, config.apiKey)");
  });

  it("tests the failure paths, not only the happy one", () => {
    const test = read("apps/web/src/server/shipping-carrier/client.test.ts");

    for (const reason of [
      "unauthorized",
      "malformedResponse",
      "timedOut",
    ] as const) {
      expect(test).toContain(reason);
    }
    expect(test).toContain("never lets the credential reach an error message");
  });

  it("says where the concrete client still has to be constructed", () => {
    expect(result.followUps.join("\n")).toContain("composition root");
    expect(result.followUps.join("\n")).toContain(".env.example");
  });

  it("changes nothing when it runs a second time", () => {
    const before = adapterRegistryEdits.map(({ file }) => read(file));

    const second = generateAdapter(root, names);

    expect(second.created).toEqual([]);
    expect(second.edited).toEqual([]);
    expect(second.skipped).toHaveLength(4);
    expect(adapterRegistryEdits.map(({ file }) => read(file))).toEqual(before);
  });
});
