import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { checkNativeFlowPolicy } from "./native-flow-policy.ts";
import { repositoryRoot } from "./repository.ts";

/**
 * The native journey is the one level `pnpm verify` cannot run on a host or a
 * runner without a simulator, which is exactly how `.maestro/smoke.yaml` came to
 * assert a screen that had been unreachable for two stages. These checks are
 * what runs everywhere instead: they cannot prove a screen is reachable, but
 * they do prove the flow still addresses this application and still quotes copy
 * the product actually ships.
 */

const appJson = JSON.stringify({
  expo: {
    android: { package: "com.example.aistarter" },
    ios: { bundleIdentifier: "com.example.aistarter" },
    name: "ai-starter",
  },
});

const catalog = JSON.stringify({
  auth: { signIn: { description: "Welcome back.", title: "Sign in" } },
});

const flow = `appId: com.example.aistarter
---
- launchApp:
    clearState: true
- assertVisible: "Welcome back."
- tapOn: "Sign in"
`;

let checkout: string | undefined;

const dutchCatalog = JSON.stringify({
  auth: { signIn: { description: "Welkom terug.", title: "Inloggen" } },
});

function build(
  overrides: Partial<
    Record<"appJson" | "catalog" | "dutchCatalog" | "flow", string>
  > = {},
): string {
  const root = mkdtempSync(path.join(tmpdir(), "native-flow-policy-"));
  checkout = root;

  mkdirSync(path.join(root, "apps/mobile/.maestro"), { recursive: true });
  mkdirSync(path.join(root, "packages/i18n/messages"), { recursive: true });
  writeFileSync(
    path.join(root, "apps/mobile/app.json"),
    overrides.appJson ?? appJson,
  );
  writeFileSync(
    path.join(root, "packages/i18n/messages/en.json"),
    overrides.catalog ?? catalog,
  );
  writeFileSync(
    path.join(root, "packages/i18n/messages/nl.json"),
    overrides.dutchCatalog ?? dutchCatalog,
  );
  if (overrides.flow !== "") {
    writeFileSync(
      path.join(root, "apps/mobile/.maestro/smoke.yaml"),
      overrides.flow ?? flow,
    );
  }

  return root;
}

afterEach(() => {
  if (checkout !== undefined) {
    rmSync(checkout, { force: true, recursive: true });
    checkout = undefined;
  }
});

describe("checkNativeFlowPolicy", () => {
  it("accepts a flow that addresses this app and quotes shipped copy", () => {
    expect(checkNativeFlowPolicy(build())).toEqual([]);
  });

  it("accepts this repository", () => {
    expect(checkNativeFlowPolicy(repositoryRoot)).toEqual([]);
  });

  it("rejects a flow whose appId no longer matches the app", () => {
    const violations = checkNativeFlowPolicy(
      build({ flow: flow.replace("com.example.aistarter", "com.example.old") }),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.problem).toContain("com.example.old");
    expect(violations[0]?.fix).toContain("com.example.aistarter");
  });

  // The drift that started this check: copy is renamed, the catalog moves on,
  // and the flow keeps asserting a sentence the product no longer says.
  it("rejects an assertion on copy the catalog no longer carries", () => {
    const violations = checkNativeFlowPolicy(
      build({ flow: flow.replace("Welcome back.", "Welcome home.") }),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.problem).toContain("Welcome home.");
    expect(violations[0]?.fix).toContain("packages/i18n/messages/");
  });

  it("rejects a tap target the catalog no longer carries", () => {
    const violations = checkNativeFlowPolicy(
      build({ flow: flow.replace('tapOn: "Sign in"', 'tapOn: "Continue"') }),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.problem).toContain("Continue");
  });

  // A device runs one language at a time, and the language a flow drives is a
  // choice the flow makes. Reading only the English catalog would report a
  // perfectly good Dutch journey as drift the moment somebody wrote one.
  it("accepts a flow that asserts copy from a translated catalog", () => {
    const violations = checkNativeFlowPolicy(
      build({
        flow: `appId: com.example.aistarter
---
- launchApp
- assertVisible: "Welkom terug."
- tapOn: "Inloggen"
`,
      }),
    );

    expect(violations).toEqual([]);
  });

  it("rejects a flow that asserts nothing", () => {
    const violations = checkNativeFlowPolicy(
      build({ flow: "appId: com.example.aistarter\n---\n- launchApp\n" }),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.problem).toContain("asserts nothing");
  });

  it("rejects a deleted flow directory", () => {
    const violations = checkNativeFlowPolicy(build({ flow: "" }));

    expect(violations).toHaveLength(1);
    expect(violations[0]?.problem).toContain("no Maestro flow");
  });

  // A regex or an accessibility id is not copy, so demanding it appear in the
  // catalog would block the flows that address elements the right way.
  it("leaves regular expressions and identifiers alone", () => {
    const violations = checkNativeFlowPolicy(
      build({
        flow: `appId: com.example.aistarter
---
- launchApp
- assertVisible: "Welcome back."
- tapOn:
    id: "sign-in-submit"
- assertVisible: ".*welcome.*"
`,
      }),
    );

    expect(violations).toEqual([]);
  });
});
