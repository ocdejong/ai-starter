import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ESLint } from "eslint";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Every rule this configuration adds, proven the way stage 01 established: plant
 * one violation per class in a checkout that is otherwise clean, and assert the
 * rule that names it. A lint rule nobody has watched fail is a rule nobody knows
 * is wired — and these are the rules that decide whether a suppression, a
 * swallowed failure or a skipped test can reach `main`.
 *
 * The probes are linted through the real exported config, with type information,
 * so a rule that quietly needs a project would fail here rather than in a
 * consumer.
 */

const probes: Readonly<Record<string, string>> = {
  "clean.ts": `
export function greet(name: string): string {
  return \`hello \${name}\`;
}
`,
  "disabled-test.ts": `
declare const describe: { (name: string, body: () => void): void; only: (name: string, body: () => void) => void };
declare const it: { (name: string, body: () => void): void; skip: (name: string, body: () => void) => void };
declare const xit: (name: string, body: () => void) => void;

describe.only("focused", () => {
  it.skip("skipped", () => undefined);
  xit("also skipped", () => undefined);
});
`,
  // Playwright spells all of this differently, and the vitest selectors miss
  // every one of them: `test.describe.skip` nests the runner one level deeper
  // than `object.name` can see, and `fixme` is a spelling vitest has no word for.
  "disabled-journey.ts": `
declare const test: {
  (name: string, body: () => void): void;
  fixme: (name: string, body: () => void) => void;
  describe: {
    (name: string, body: () => void): void;
    skip: (name: string, body: () => void) => void;
    fixme: (name: string, body: () => void) => void;
  };
};

test.describe.skip("skipped group", () => {
  test("unreachable", () => undefined);
});
test.describe.fixme("broken group", () => undefined);
test.fixme("expected to fail", () => undefined);
`,
  "empty-catch.ts": `
export function parse(text: string): void {
  try {
    JSON.parse(text);
  } catch {}
}
`,
  "laundered-assertion.ts": `
declare const text: string;
export const laundered = text as unknown as { count: number };
`,
  "non-null.ts": `
declare const maybe: { name: string } | undefined;
export const name = maybe!.name;
`,
  "object-assertion.ts": `
type Settings = { host: string; port: number };
export const settings = {} as Settings;
`,
  "stale-directive.ts": `
// eslint-disable-next-line no-empty -- nothing here is empty
export const value = 1;
`,
  "unawaited-promise.ts": `
declare function save(): Promise<void>;
export function run(): void {
  save();
}
`,
};

/** JSX probes for the rules that guard product copy and colour. */
const uiProbes: Readonly<Record<string, string>> = {
  "clean-ui.tsx": `
declare function useTranslations(): (key: string) => string;

export function Panel(): JSX.Element {
  const t = useTranslations();
  return <p className="text-muted-foreground">{t("intro")}</p>;
}
`,
  "hardcoded-attribute.tsx": `
export function Field(): JSX.Element {
  return <input aria-label="Email address" placeholder="you@example.com" />;
}
`,
  "hardcoded-text.tsx": `
export function Panel(): JSX.Element {
  return <p>Welcome back</p>;
}
`,
  "laundered-in-ui.tsx": `
declare const text: string;
export const laundered = text as unknown as { count: number };
`,
  "palette-utility.tsx": `
export function Badge(): JSX.Element {
  return <span className="bg-red-500 text-white">!</span>;
}
`,
  "raw-colour.tsx": `
export const styles = { container: { backgroundColor: "#0a0a0a" } };
`,
};

const checkouts: string[] = [];

/**
 * A real config file importing the shipped one, rather than an in-process
 * object: it is how a consumer loads this configuration, and it keeps the two
 * ESLint type packages in the dependency tree from having to agree.
 */
async function lintProbes(
  label: string,
  files: Readonly<Record<string, string>>,
  config: string,
): Promise<Map<string, string[]>> {
  const checkout = mkdtempSync(path.join(tmpdir(), `eslint-${label}-`));
  checkouts.push(checkout);
  mkdirSync(path.join(checkout, "src"));
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
      include: ["src/**/*.ts", "src/**/*.tsx"],
    }),
  );

  for (const [name, source] of Object.entries(files)) {
    writeFileSync(path.join(checkout, "src", name), source.trimStart());
  }

  const configFile = path.join(checkout, "eslint.config.js");
  writeFileSync(configFile, config);

  const eslint = new ESLint({ cwd: checkout, overrideConfigFile: configFile });

  return new Map(
    (await eslint.lintFiles(["src"])).map((file) => [
      path.basename(file.filePath),
      file.messages.map((message) => message.ruleId ?? "unused-disable"),
    ]),
  );
}

const shipped = (file: string): string =>
  JSON.stringify(path.join(import.meta.dirname, file));

let results: Map<string, string[]>;
let uiResults: Map<string, string[]>;

beforeAll(async () => {
  results = await lintProbes(
    "rules",
    probes,
    `import baseConfig from ${shipped("base.js")};

export default [
  ...baseConfig,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
];
`,
  );

  uiResults = await lintProbes(
    "product",
    uiProbes,
    `import baseConfig from ${shipped("base.js")};
import { productUiRules } from ${shipped("product.js")};

export default [
  ...baseConfig,
  {
    files: ["**/*.tsx", "**/*.ts"],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: productUiRules,
  },
];
`,
  );
}, 120_000);

afterAll(() => {
  for (const checkout of checkouts) {
    rmSync(checkout, { force: true, recursive: true });
  }
});

const rulesFor = (probe: string): string[] => results.get(probe) ?? [];
const uiRulesFor = (probe: string): string[] => uiResults.get(probe) ?? [];

describe("the shared TypeScript rules", () => {
  it("passes code that breaks none of them", () => {
    expect(rulesFor("clean.ts")).toEqual([]);
  });

  // `as unknown as T` asserts between unrelated types by laundering through the
  // one type everything is assignable to, which is precisely the check `as`
  // would otherwise have made.
  it("rejects an assertion laundered through unknown", () => {
    expect(rulesFor("laundered-assertion.ts")).toContain(
      "no-restricted-syntax",
    );
  });

  // An object literal asserted into a type is checked for nothing it omits.
  it("rejects an object literal asserted into a type", () => {
    expect(rulesFor("object-assertion.ts")).toContain(
      "@typescript-eslint/consistent-type-assertions",
    );
  });

  it("rejects a non-null assertion", () => {
    expect(rulesFor("non-null.ts")).toContain(
      "@typescript-eslint/no-non-null-assertion",
    );
  });

  // A caught error that is neither handled nor recorded turns a failure into a
  // silent success.
  it("rejects an empty catch", () => {
    expect(rulesFor("empty-catch.ts")).toContain("no-empty");
  });

  it("rejects a promise nobody waits for", () => {
    expect(rulesFor("unawaited-promise.ts")).toContain(
      "@typescript-eslint/no-floating-promises",
    );
  });

  // Three ways to stop a test running; each reports a pass the suite never ran.
  it("rejects a skipped or focused test", () => {
    expect(
      rulesFor("disabled-test.ts").filter(
        (rule) => rule === "no-restricted-syntax",
      ),
    ).toHaveLength(3);
  });

  // The journeys are where a skip hides longest: nobody reads a Playwright
  // report that says "1 skipped", and the native flow has skipped for real
  // since stage 15 for a reason the harness prints on every run.
  it("rejects a skipped, focused or fixme'd journey", () => {
    expect(
      rulesFor("disabled-journey.ts").filter(
        (rule) => rule === "no-restricted-syntax",
      ),
    ).toHaveLength(3);
  });

  // ESLint reports these as warnings by default, and a warning fails nothing.
  it("rejects a disable directive that no longer suppresses anything", () => {
    expect(rulesFor("stale-directive.ts")).toContain("unused-disable");
  });
});

/**
 * The two conventions stages 03 and 04 established and deferred: colour comes
 * from the token package, copy comes from both catalogs. Neither was enforced
 * until now, so each is proven the same way — one planted violation per class.
 */
describe("the product UI rules", () => {
  it("passes a component that translates its copy and uses semantic colour", () => {
    expect(uiRulesFor("clean-ui.tsx")).toEqual([]);
  });

  it("rejects a raw colour value", () => {
    expect(uiRulesFor("raw-colour.tsx")).toContain("no-restricted-syntax");
  });

  it("rejects a Tailwind palette utility", () => {
    expect(uiRulesFor("palette-utility.tsx")).toHaveLength(2);
  });

  it("rejects text a person reads that no catalog supplies", () => {
    expect(uiRulesFor("hardcoded-text.tsx")).toContain("no-restricted-syntax");
  });

  // `react/jsx-no-literals` ignores attributes by default, and these are where
  // the strings a screen reader announces actually live.
  it("rejects a hardcoded label, placeholder or alternative text", () => {
    expect(uiRulesFor("hardcoded-attribute.tsx")).toHaveLength(2);
  });

  // ESLint replaces a rule's options rather than merging them, so a config that
  // sets `no-restricted-syntax` again drops every selector it does not restate.
  it("keeps the shared suppression rules the app config would have replaced", () => {
    expect(uiRulesFor("laundered-in-ui.tsx")).toContain("no-restricted-syntax");
  });
});
