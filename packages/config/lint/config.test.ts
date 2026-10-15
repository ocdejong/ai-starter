import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { lintConfig } from "./config.js";

/**
 * Every rule this configuration adds, proven the way stage 01 established: plant
 * one violation per class in a checkout that is otherwise clean, and assert the
 * rule that names it. A lint rule nobody has watched fail is a rule nobody knows
 * is wired — and these are the rules that decide whether a suppression, a
 * swallowed failure or a skipped test can reach `main`.
 *
 * The probes are linted by the real `vp lint`, through the exported config, with
 * type information, at the paths the overrides key on — so a rule that quietly
 * needs a project, or an override whose glob stopped matching, fails here rather
 * than in a consumer.
 */

const declarations = `
declare const process: { env: Record<string, string | undefined> };
declare const describe: { (name: string, body: () => void): void; only: (name: string, body: () => void) => void };
declare const it: { (name: string, body: () => void): void; skip: (name: string, body: () => void) => void };
declare const xit: (name: string, body: () => void) => void;
declare const test: {
  (name: string, body: () => void): void;
  fixme: (name: string, body: () => void) => void;
  describe: {
    (name: string, body: () => void): void;
    skip: (name: string, body: () => void) => void;
    fixme: (name: string, body: () => void) => void;
  };
};
declare function useTranslations(): (key: string) => string;
`;

const probes: Readonly<Record<string, string>> = {
  "packages/api/src/clean.ts": `
export function greet(name: string): string {
  return \`hello \${name}\`;
}
`,
  "packages/api/src/disabled-test.ts": `
describe.only("focused", () => {
  it.skip("skipped", () => undefined);
  xit("also skipped", () => undefined);
});
`,
  // Playwright spells all of this differently, and the vitest selectors miss
  // every one of them: `test.describe.skip` nests the runner one level deeper
  // than `object.name` can see, and `fixme` is a spelling vitest has no word for.
  "packages/api/src/disabled-journey.ts": `
test.describe.skip("skipped group", () => {
  test("unreachable", () => undefined);
});
test.describe.fixme("broken group", () => undefined);
test.fixme("expected to fail", () => undefined);
`,
  "packages/api/src/empty-catch.ts": `
export function parse(text: string): void {
  try {
    JSON.parse(text);
  } catch {}
}
`,
  "packages/api/src/laundered-assertion.ts": `
declare const text: string;
export const laundered = text as unknown as { count: number };
`,
  "packages/api/src/non-null.ts": `
declare const maybe: { name: string } | undefined;
export const name = maybe!.name;
`,
  "packages/api/src/object-assertion.ts": `
type Settings = { host: string; port: number };
export const settings = {} as Settings;
`,
  "packages/api/src/stale-directive.ts": `
// eslint-disable-next-line no-empty -- nothing here is empty
export const value = 1;
`,
  "packages/api/src/unawaited-promise.ts": `
declare function save(): Promise<void>;
export function run(): void {
  save();
}
`,
  "packages/domain/src/platform-import.ts": `
import { useState } from "react";
export const hook = useState;
`,
  "packages/domain/src/reads-environment.ts": `
export const region = process.env.REGION;
`,
  "apps/mobile/src/inlinable-env.ts": `
export const url = process.env.EXPO_PUBLIC_API_URL;
`,
  "apps/mobile/src/uninlinable-env.ts": `
declare const name: string;
export const dynamic = process.env[name];
const { EXPO_PUBLIC_API_URL } = process.env;
export const destructured = EXPO_PUBLIC_API_URL;
`,
  "apps/web/src/clean-ui.tsx": `
export function Panel(): JSX.Element {
  const t = useTranslations();
  return <p className="text-muted-foreground">{t("intro")}</p>;
}
`,
  "apps/web/src/hardcoded-attribute.tsx": `
export function Field(): JSX.Element {
  return <input aria-label="Email address" placeholder="you@example.com" />;
}
`,
  "apps/web/src/hardcoded-text.tsx": `
export function Panel(): JSX.Element {
  return <p>Welcome back</p>;
}
`,
  "apps/web/src/palette-utility.tsx": `
export function Badge(): JSX.Element {
  return <span className="bg-red-500 text-white">!</span>;
}
`,
  "apps/web/src/raw-colour.tsx": `
export const styles = { container: { backgroundColor: "#0a0a0a" } };
`,
  // A test renders a literal to prove a component shows what it was given.
  "apps/web/src/panel.test.tsx": `
export function Fixture(): JSX.Element {
  return <p style={{ color: "#0a0a0a" }}>Welcome back</p>;
}
`,
};

type Diagnostic = {
  readonly code?: string;
  readonly filename: string;
};

let checkout: string;
let results: Map<string, string[]>;

/** The `vp` binary this package depends on, run by the current Node. */
function vpBinary(): string {
  const require = createRequire(import.meta.url);
  const manifestPath = require.resolve("vite-plus/package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    bin: string | Record<string, string>;
  };
  const bin = typeof manifest.bin === "string" ? manifest.bin : manifest.bin.vp;
  if (bin === undefined) {
    throw new Error("vite-plus declares no `vp` binary.");
  }
  return path.join(path.dirname(manifestPath), bin);
}

beforeAll(() => {
  checkout = mkdtempSync(path.join(tmpdir(), "oxlint-config-"));
  writeFileSync(
    path.join(checkout, "package.json"),
    JSON.stringify({ name: "lint-probe", private: true, type: "module" }),
  );
  writeFileSync(
    path.join(checkout, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        jsx: "react-jsx",
        module: "ESNext",
        moduleResolution: "Bundler",
        noEmit: true,
        strict: true,
        target: "ES2022",
      },
      include: ["**/*.ts", "**/*.tsx"],
    }),
  );
  writeFileSync(path.join(checkout, "globals.d.ts"), declarations);
  writeFileSync(
    path.join(checkout, ".oxlintrc.json"),
    JSON.stringify(lintConfig),
  );

  for (const [file, source] of Object.entries(probes)) {
    mkdirSync(path.join(checkout, path.dirname(file)), { recursive: true });
    writeFileSync(path.join(checkout, file), source.trimStart());
  }

  let output: string;
  try {
    output = execFileSync(
      process.execPath,
      [vpBinary(), "lint", "-c", ".oxlintrc.json", "-f", "json", "."],
      { cwd: checkout, encoding: "utf8" },
    );
  } catch (error) {
    // A finding exits non-zero, which is the point of every probe but one.
    const stdout = (error as { stdout?: unknown }).stdout;
    if (typeof stdout !== "string" || stdout === "") {
      throw error;
    }
    output = stdout;
  }

  const report = JSON.parse(output) as { diagnostics: Diagnostic[] };
  results = new Map();
  for (const diagnostic of report.diagnostics) {
    const rules = results.get(diagnostic.filename) ?? [];
    rules.push(diagnostic.code ?? "unused-disable");
    results.set(diagnostic.filename, rules);
  }
}, 120_000);

afterAll(() => {
  rmSync(checkout, { force: true, recursive: true });
});

const rulesFor = (probe: string): string[] => results.get(probe) ?? [];

describe("the shared TypeScript rules", () => {
  it("passes code that breaks none of them", () => {
    expect(rulesFor("packages/api/src/clean.ts")).toEqual([]);
  });

  // `as unknown as T` asserts between unrelated types by laundering through the
  // one type everything is assignable to, which is precisely the check `as`
  // would otherwise have made.
  it("rejects an assertion laundered through unknown", () => {
    expect(rulesFor("packages/api/src/laundered-assertion.ts")).toContain(
      "guard(no-laundered-assertion)",
    );
  });

  // An object literal asserted into a type is checked for nothing it omits.
  it("rejects an object literal asserted into a type", () => {
    expect(rulesFor("packages/api/src/object-assertion.ts")).toContain(
      "typescript(consistent-type-assertions)",
    );
  });

  it("rejects a non-null assertion", () => {
    expect(rulesFor("packages/api/src/non-null.ts")).toContain(
      "typescript(no-non-null-assertion)",
    );
  });

  // A caught error that is neither handled nor recorded turns a failure into a
  // silent success.
  it("rejects an empty catch", () => {
    expect(rulesFor("packages/api/src/empty-catch.ts")).toContain(
      "eslint(no-empty)",
    );
  });

  it("rejects a promise nobody waits for", () => {
    expect(rulesFor("packages/api/src/unawaited-promise.ts")).toContain(
      "typescript(no-floating-promises)",
    );
  });

  // Three ways to stop a test running; each reports a pass the suite never ran.
  it("rejects a skipped or focused test", () => {
    expect(
      rulesFor("packages/api/src/disabled-test.ts").filter(
        (rule) => rule === "guard(no-disabled-test)",
      ),
    ).toHaveLength(3);
  });

  // The journeys are where a skip hides longest: nobody reads a Playwright
  // report that says "1 skipped", and the native flow has skipped for real
  // since stage 15 for a reason the harness prints on every run.
  it("rejects a skipped, focused or fixme'd journey", () => {
    expect(
      rulesFor("packages/api/src/disabled-journey.ts").filter(
        (rule) => rule === "guard(no-disabled-test)",
      ),
    ).toHaveLength(3);
  });

  // Oxlint ignores these by default, and an ignored claim fails nothing.
  it("rejects a disable directive that no longer suppresses anything", () => {
    expect(rulesFor("packages/api/src/stale-directive.ts")).toContain(
      "unused-disable",
    );
  });
});

describe("the layering rules", () => {
  it("keeps platform dependencies out of the domain", () => {
    expect(rulesFor("packages/domain/src/platform-import.ts")).toContain(
      "eslint(no-restricted-imports)",
    );
  });

  it("keeps the domain from reading its own configuration", () => {
    expect(rulesFor("packages/domain/src/reads-environment.ts")).toContain(
      "guard(no-process-env)",
    );
  });

  // Expo inlines `process.env.EXPO_PUBLIC_*` by matching the whole member
  // expression; anything else ships `undefined` to the device.
  it("passes an environment read Expo can inline", () => {
    expect(rulesFor("apps/mobile/src/inlinable-env.ts")).toEqual([]);
  });

  it("rejects a computed or destructured environment read in the app", () => {
    expect(
      rulesFor("apps/mobile/src/uninlinable-env.ts").filter(
        (rule) => rule === "guard(no-uninlinable-env)",
      ),
    ).toHaveLength(2);
  });
});

/**
 * The two conventions stages 03 and 04 established and deferred: colour comes
 * from the token package, copy comes from both catalogs. Each is proven the same
 * way — one planted violation per class.
 */
describe("the product UI rules", () => {
  it("passes a component that translates its copy and uses semantic colour", () => {
    expect(rulesFor("apps/web/src/clean-ui.tsx")).toEqual([]);
  });

  it("rejects a raw colour value", () => {
    expect(rulesFor("apps/web/src/raw-colour.tsx")).toContain(
      "guard(no-raw-colour)",
    );
  });

  it("rejects a Tailwind palette utility", () => {
    // Two findings: the palette utility, and the `!` no catalog supplies.
    const rules = rulesFor("apps/web/src/palette-utility.tsx");
    expect(rules).toHaveLength(2);
    expect(rules).toEqual(
      expect.arrayContaining([
        "guard(no-raw-colour)",
        "guard(no-literal-copy)",
      ]),
    );
  });

  it("rejects text a person reads that no catalog supplies", () => {
    expect(rulesFor("apps/web/src/hardcoded-text.tsx")).toContain(
      "guard(no-literal-copy)",
    );
  });

  // `react/jsx-no-literals` ignores attributes by default, and these are where
  // the strings a screen reader announces actually live.
  it("rejects a hardcoded label, placeholder or alternative text", () => {
    expect(
      rulesFor("apps/web/src/hardcoded-attribute.tsx").filter(
        (rule) => rule === "guard(no-literal-copy)",
      ),
    ).toHaveLength(2);
  });

  it("leaves a test free to render the literal it asserts on", () => {
    expect(rulesFor("apps/web/src/panel.test.tsx")).toEqual([]);
  });
});
