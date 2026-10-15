import { fileURLToPath } from "node:url";

/**
 * The repository's lint configuration: one Oxlint config for every workspace,
 * read by `vp lint` and `vp check` from the root `vite.config.ts`.
 *
 * Vite+ reads lint settings from the workspace root only, so what used to be a
 * per-package ESLint config is an override here, keyed by directory. Name
 * directories and globs, never workspace package names as keys: `pnpm
 * starter:init` rewrites the scope, and a key would stop matching.
 *
 * The rule set is the one the ESLint configs enforced — typescript-eslint's
 * `recommended`, `recommendedTypeChecked` and `stylisticTypeChecked`, Next.js's
 * `core-web-vitals`, Expo's flat config — rule for rule, with Oxlint's own
 * `correctness` category on top. Four upstream rules have no Oxlint equivalent
 * and are gone: `react-hooks/config` and `react-hooks/gating` validate React
 * Compiler options this repository does not set, `react/no-deprecated` guards
 * legacy React APIs React 19 no longer ships, and `import/no-unresolved` is a
 * weaker form of the type check.
 */

const plugin = fileURLToPath(new URL("./plugin.js", import.meta.url));

/**
 * Ways to make the type checker agree with code it cannot vouch for, and ways to
 * make a suite report a pass it did not earn. The presets reject `any` and every
 * unsafe operation on one; the rules after them close what the presets leave
 * open. Each is proven by a planted violation in `config.test.ts`.
 *
 * @type {Record<string, unknown>}
 */
const typescriptRules = {
  // typescript-eslint `recommended`, with ESLint's own rules it switches on.
  "no-var": "error",
  "prefer-const": "error",
  "prefer-rest-params": "error",
  "prefer-spread": "error",
  "no-array-constructor": "error",
  "no-unused-expressions": "error",
  "typescript/ban-ts-comment": "error",
  "typescript/no-duplicate-enum-values": "error",
  "typescript/no-empty-object-type": "error",
  "typescript/no-explicit-any": "error",
  "typescript/no-extra-non-null-assertion": "error",
  "typescript/no-misused-new": "error",
  "typescript/no-namespace": "error",
  "typescript/no-non-null-asserted-optional-chain": "error",
  "typescript/no-require-imports": "error",
  "typescript/no-this-alias": "error",
  "typescript/no-unnecessary-type-constraint": "error",
  "typescript/no-unsafe-declaration-merging": "error",
  "typescript/no-unsafe-function-type": "error",
  "typescript/no-wrapper-object-types": "error",
  "typescript/prefer-as-const": "error",
  "typescript/prefer-namespace-keyword": "error",
  "typescript/triple-slash-reference": "error",
  // `recommendedTypeChecked`: the rules that need the type checker.
  "typescript/await-thenable": "error",
  "typescript/no-array-delete": "error",
  "typescript/no-base-to-string": "error",
  "typescript/no-duplicate-type-constituents": "error",
  "typescript/no-floating-promises": "error",
  "typescript/no-for-in-array": "error",
  "typescript/no-implied-eval": "error",
  "typescript/no-misused-promises": [
    "error",
    { checksVoidReturn: { attributes: false } },
  ],
  "typescript/no-redundant-type-constituents": "error",
  "typescript/no-unnecessary-type-assertion": "error",
  "typescript/no-unsafe-argument": "error",
  "typescript/no-unsafe-assignment": "error",
  "typescript/no-unsafe-call": "error",
  "typescript/no-unsafe-enum-comparison": "error",
  "typescript/no-unsafe-member-access": "error",
  "typescript/no-unsafe-return": "error",
  "typescript/no-unsafe-unary-minus": "error",
  "typescript/only-throw-error": "error",
  "typescript/prefer-promise-reject-errors": "error",
  "typescript/restrict-plus-operands": "error",
  "typescript/restrict-template-expressions": "error",
  "typescript/unbound-method": "error",
  // `stylisticTypeChecked`, less `array-type` and `consistent-type-definitions`.
  "no-empty-function": "error",
  "typescript/adjacent-overload-signatures": "error",
  "typescript/ban-tslint-comment": "error",
  "typescript/class-literal-property-style": "error",
  "typescript/consistent-generic-constructors": "error",
  "typescript/consistent-indexed-object-style": "error",
  "typescript/dot-notation": "error",
  "typescript/no-confusing-non-null-assertion": "error",
  "typescript/no-inferrable-types": "error",
  "typescript/non-nullable-type-assertion-style": "error",
  "typescript/prefer-find": "error",
  "typescript/prefer-for-of": "error",
  "typescript/prefer-function-type": "error",
  "typescript/prefer-includes": "error",
  "typescript/prefer-nullish-coalescing": "error",
  "typescript/prefer-optional-chain": "error",
  "typescript/prefer-regexp-exec": "error",
  "typescript/prefer-string-starts-ends-with": "error",
  // An object literal asserted into a type is checked for nothing it omits, so
  // it is the one assertion that silently invents data.
  "typescript/consistent-type-assertions": [
    "error",
    { assertionStyle: "as", objectLiteralTypeAssertions: "never" },
  ],
  "typescript/consistent-type-imports": [
    "error",
    { fixStyle: "inline-type-imports", prefer: "type-imports" },
  ],
  "typescript/no-non-null-assertion": "error",
  "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  "typescript/switch-exhaustiveness-check": "error",
  // A caught error that is neither handled nor recorded turns a failure into a
  // silent success, which is the hardest kind of bug to find later.
  "no-empty": ["error", { allowEmptyCatch: false }],
  "guard/no-laundered-assertion": "error",
  "guard/no-disabled-test": "error",
};

/** React's recommended rules and the React Compiler's, shared by both apps. */
const reactRules = {
  "react/display-name": "error",
  "react/jsx-key": "error",
  "react/jsx-no-comment-textnodes": "error",
  "react/jsx-no-duplicate-props": "error",
  "react/jsx-no-undef": "error",
  "react/no-children-prop": "error",
  "react/no-danger-with-children": "error",
  "react/no-direct-mutation-state": "error",
  "react/no-find-dom-node": "error",
  "react/no-is-mounted": "error",
  "react/no-render-return-value": "error",
  "react/no-string-refs": "error",
  "react/no-unescaped-entities": "error",
  "react/require-render-return": "error",
  "react/rules-of-hooks": "error",
  "react/exhaustive-deps": "warn",
  "react/static-components": "error",
  "react/use-memo": "error",
  "react/preserve-manual-memoization": "error",
  "react/incompatible-library": "warn",
  "react/immutability": "error",
  "react/globals": "error",
  "react/refs": "error",
  "react/set-state-in-effect": "error",
  "react/error-boundaries": "error",
  "react/purity": "error",
  "react/set-state-in-render": "error",
  "react/unsupported-syntax": "warn",
};

/** `eslint-config-next/core-web-vitals`. */
const nextRules = {
  "nextjs/google-font-display": "warn",
  "nextjs/google-font-preconnect": "warn",
  "nextjs/next-script-for-ga": "warn",
  "nextjs/no-async-client-component": "warn",
  "nextjs/no-before-interactive-script-outside-document": "warn",
  "nextjs/no-css-tags": "warn",
  "nextjs/no-head-element": "warn",
  "nextjs/no-html-link-for-pages": "error",
  "nextjs/no-img-element": "warn",
  "nextjs/no-page-custom-font": "warn",
  "nextjs/no-styled-jsx-in-document": "warn",
  "nextjs/no-sync-scripts": "error",
  "nextjs/no-title-in-document-head": "warn",
  "nextjs/no-typos": "warn",
  "nextjs/no-unwanted-polyfillio": "warn",
  "nextjs/inline-script-id": "error",
  "nextjs/no-assign-module-variable": "error",
  "nextjs/no-document-import-in-page": "error",
  "nextjs/no-duplicate-head": "error",
  "nextjs/no-head-import-in-document": "error",
  "nextjs/no-script-component-in-head": "error",
  "import/no-anonymous-default-export": "warn",
  "jsx-a11y/alt-text": ["warn", { elements: ["img"], img: ["Image"] }],
  "jsx-a11y/aria-props": "warn",
  "jsx-a11y/aria-proptypes": "warn",
  "jsx-a11y/aria-unsupported-elements": "warn",
  "jsx-a11y/role-has-required-aria-props": "warn",
  "jsx-a11y/role-supports-aria-props": "warn",
};

/** `eslint-config-expo`'s flat config, with its env rules ported to `guard`. */
const expoRules = {
  "import/export": "error",
  "import/no-named-as-default": "warn",
  "import/no-named-as-default-member": "warn",
  "import/no-duplicates": "warn",
  "import/first": "warn",
  eqeqeq: ["warn", "smart"],
  "no-extend-native": "warn",
  "no-extra-bind": "warn",
  "no-useless-constructor": "warn",
  "no-redeclare": "warn",
  "react/no-unknown-property": "warn",
  "react/no-this-in-sfc": "warn",
  "guard/no-uninlinable-env": "error",
};

/**
 * Rules Oxlint's `correctness` category switches on with the `jsx-a11y` and
 * `import` plugins that the ESLint configs never ran, each answered here.
 */
const declinedCorrectnessRules = {
  // Reads every `role` prop as an ARIA role, including a component's own
  // `role` prop (an invitation's membership role, for one).
  "jsx-a11y/aria-role": ["warn", { ignoreNonDOM: true }],
  // `<output>` is a form-result element, not a general live region; the
  // `role="status"` it would replace is the WAI-ARIA pattern for one.
  "jsx-a11y/prefer-tag-over-role": "off",
  // Does not follow `export *`, so it misreports `@sentry/nextjs`; the type
  // check already proves a namespace member exists.
  "import/namespace": "off",
};

/**
 * Rules for product UI — the two applications' `src/` trees. Not for tests: a
 * test legitimately renders a literal to prove a component shows what it was
 * given, and a hex in a fixture is data rather than design.
 */
const productUiOverride = {
  excludeFiles: [
    "apps/*/src/**/*.test.{ts,tsx}",
    "apps/*/src/test/**",
    "apps/*/src/**/__tests__/**",
  ],
  files: ["apps/web/src/**/*.{ts,tsx}", "apps/mobile/src/**/*.{ts,tsx}"],
  rules: { "guard/no-literal-copy": "error", "guard/no-raw-colour": "error" },
};

/**
 * @param {readonly string[]} files
 * @param {readonly { name: string; message: string }[]} paths
 * @param {readonly { group: readonly string[]; message: string }[]} patterns
 */
function restrictImports(files, paths, patterns = []) {
  return {
    files,
    rules: { "no-restricted-imports": ["error", { paths, patterns }] },
  };
}

/** The dependency direction each layer keeps, as the importer sees it. */
const layering = [
  restrictImports(
    ["apps/web/src/app/**/*.{ts,tsx}", "apps/web/src/trpc/**/*.{ts,tsx}"],
    [
      {
        message:
          "UI and transport code must reach the database through server modules or tRPC.",
        name: "@ai-starter/db",
      },
    ],
    [
      {
        group: ["@ai-starter/db/*"],
        message: "UI and transport code must not import database internals.",
      },
    ],
  ),
  restrictImports(
    ["apps/mobile/src/**/*.{ts,tsx}"],
    [
      {
        message:
          "Mobile may import only public client types from @ai-starter/api/client.",
        name: "@ai-starter/api",
      },
      { message: "Database code is server-only.", name: "@ai-starter/db" },
      { message: "Next.js modules are web-only.", name: "next" },
      {
        message: "Server-only modules cannot run in React Native.",
        name: "server-only",
      },
    ],
    [
      {
        group: ["@ai-starter/db/*", "next/*"],
        message: "This module is unavailable in the mobile runtime.",
      },
    ],
  ),
  restrictImports(
    ["packages/api/src/**/*.{ts,tsx}"],
    [
      { message: "The API package is server-only.", name: "expo" },
      { message: "Keep framework adapters in apps/web.", name: "next" },
      { message: "The API package is server-only.", name: "react" },
      { message: "The API package is server-only.", name: "react-native" },
    ],
    [
      {
        group: ["expo/*", "next/*", "react-native/*"],
        message: "Keep platform dependencies out of the shared API.",
      },
    ],
  ),
  restrictImports(
    ["packages/auth/src/**/*.{ts,tsx}"],
    [
      { message: "Keep framework adapters in apps/web.", name: "next" },
      { message: "The auth factory is a server package.", name: "react" },
      {
        message: "The auth factory is a server package.",
        name: "react-native",
      },
    ],
    [
      {
        group: ["next/*", "react-native/*"],
        message: "Keep platform adapters out of the auth factory.",
      },
    ],
  ),
  restrictImports(
    ["packages/db/src/**/*.{ts,tsx}"],
    [
      {
        message: "The database is below the API layer.",
        name: "@ai-starter/api",
      },
      { message: "The database package is server-only.", name: "expo" },
      { message: "Keep framework adapters in apps/web.", name: "next" },
      { message: "The database package is server-only.", name: "react" },
      { message: "The database package is server-only.", name: "react-native" },
    ],
    [
      {
        group: ["@ai-starter/api/*", "expo/*", "next/*", "react-native/*"],
        message: "The database package must not depend on higher layers.",
      },
    ],
  ),
  restrictImports(
    ["packages/domain/src/**/*.{ts,tsx}"],
    [
      { message: "Domain code is dependency-free.", name: "@ai-starter/api" },
      { message: "Domain code is dependency-free.", name: "@ai-starter/db" },
      { message: "Domain code is platform-independent.", name: "expo" },
      { message: "Domain code is platform-independent.", name: "next" },
      { message: "Domain code is framework-independent.", name: "react" },
      { message: "Domain code is platform-independent.", name: "react-native" },
    ],
    [
      {
        group: [
          "@ai-starter/api/*",
          "@ai-starter/db/*",
          "expo/*",
          "next/*",
          "react-native/*",
        ],
        message: "Domain code must stay portable across runtimes.",
      },
    ],
  ),
  restrictImports(
    ["packages/i18n/src/**/*.ts"],
    [
      {
        message: "Shared catalogs must stay platform-neutral.",
        name: "next",
      },
      {
        message:
          "next-intl is web-only; keep it in apps/web. This package holds the catalogs both platforms share.",
        name: "next-intl",
      },
      {
        message: "Shared catalogs must be plain data plus pure helpers.",
        name: "react",
      },
      {
        message: "Shared catalogs must stay platform-neutral.",
        name: "react-native",
      },
    ],
    [
      {
        group: ["expo", "expo/*", "expo-*", "next/*", "react-native/*"],
        message:
          "Shared catalogs must stay portable across web and native runtimes.",
      },
    ],
  ),
  restrictImports(
    ["packages/tokens/src/**/*.{ts,tsx}"],
    [
      {
        message: "Design tokens are dependency-free.",
        name: "@ai-starter/api",
      },
      { message: "Design tokens are dependency-free.", name: "@ai-starter/db" },
      { message: "Design tokens are platform-independent.", name: "expo" },
      { message: "Design tokens are platform-independent.", name: "next" },
      { message: "Design tokens must be plain data.", name: "react" },
      { message: "Design tokens must be plain data.", name: "react-native" },
    ],
    [
      {
        group: [
          "@ai-starter/api/*",
          "@ai-starter/db/*",
          "expo/*",
          "next/*",
          "react-native/*",
        ],
        message: "Design tokens must stay portable across runtimes.",
      },
    ],
  ),
  restrictImports(
    ["packages/tooling/src/**/*.{ts,tsx}"],
    [],
    [
      {
        group: [
          "@ai-starter/api",
          "@ai-starter/api/*",
          "@ai-starter/db",
          "@ai-starter/db/*",
          "@ai-starter/domain",
          "@ai-starter/domain/*",
          "@ai-starter/tokens",
          "@ai-starter/tokens/*",
        ],
        message:
          "Repository tooling must not depend on product code; it runs before dependencies exist.",
      },
    ],
  ),
];

/** @type {import("vite-plus/lint").OxlintConfig} */
export const lintConfig = {
  ignorePatterns: [
    "**/.expo/**",
    "**/.next/**",
    "**/dist/**",
    "**/coverage/**",
    "apps/web/next-env.d.ts",
    "apps/web/playwright-report/**",
    "apps/web/test-results/**",
    "packages/db/generated/**",
  ],
  jsPlugins: [
    { name: "guard", specifier: plugin },
    { name: "vite-plus", specifier: "vite-plus/oxlint-plugin" },
  ],
  options: {
    // A disable comment that no longer suppresses anything is a claim about the
    // code that stopped being true, and `pnpm policy` only checks that a
    // disable carries a justification — not that it still has a rule to
    // silence. Oxlint ignores these by default, and an ignored claim fails
    // nothing.
    reportUnusedDisableDirectives: "error",
    typeAware: true,
  },
  plugins: ["typescript", "oxc", "unicorn", "react", "import", "jsx-a11y"],
  rules: {
    ...declinedCorrectnessRules,
    // Test code imports Vitest through `vite-plus/test`, the runner `vp test`
    // actually loads; a bare `vitest` import can resolve a second copy.
    "vite-plus/prefer-vite-plus-imports": "error",
  },
  settings: { next: { rootDir: "apps/web/" } },
  overrides: [
    { files: ["**/*.{ts,tsx,mts,cts}"], rules: typescriptRules },
    {
      files: ["apps/web/**/*.{js,jsx,ts,tsx}"],
      plugins: ["nextjs"],
      rules: { ...reactRules, ...nextRules },
    },
    {
      files: ["apps/mobile/**/*.{js,jsx,ts,tsx,cjs}"],
      rules: { ...reactRules, ...expoRules },
    },
    productUiOverride,
    ...layering,
    {
      files: [
        "packages/domain/src/**/*.{ts,tsx}",
        "packages/tokens/src/**/*.{ts,tsx}",
      ],
      rules: { "guard/no-process-env": "error" },
    },
  ],
};
