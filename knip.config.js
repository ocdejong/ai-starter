/**
 * What Knip is asked to find, and everything it cannot see on its own.
 *
 * `pnpm knip` reports files, exports and dependencies nothing reaches. It is the
 * one check that fails on code which is *correct* — a module every other gate
 * happily compiles, lints and even tests, while no path through the product
 * leads to it. That is the shape entropy takes in a repository agents write: a
 * slice replaced rather than removed, an export widened for one caller that
 * later moved.
 *
 * Two rules for editing this file. Name directories and globs, never workspace
 * package names: `pnpm starter:init` rewrites the `@ai-starter/` scope
 * everywhere, and a config keyed on those names would leave the renamed product
 * with a broken `knip` step. And every entry below is either an entry point Knip
 * cannot infer or a dependency reached through something other than an import —
 * each with the reason it is here. An entry added to silence a finding without
 * one is how this file stops meaning anything.
 */

/** @type {import("knip").KnipConfig} */
const config = {
  ignoreBinaries: [
    // Installed on the machine that owns a device, not from npm.
    "maestro",
  ],
  ignoreDependencies: [
    // Required at run time by the client Prisma generates into
    // packages/db/generated/, which is gitignored and so invisible to a graph
    // built from the checkout.
    "@prisma/client",
    // The same, one level down, and it has to be declared rather than merely
    // installed: Prisma 7's generated runtime imports it, and that output sits
    // outside `node_modules`, so pnpm's isolated layout only resolves it when
    // `packages/db` names it a direct dependency. Without the declaration Next
    // fails to build with `Can't resolve '@prisma/client-runtime-utils'`.
    "@prisma/client-runtime-utils",
    // Injected into compiled output by the Expo/Metro Babel transform.
    "@babel/runtime",
    // Reached through `compat.extends("next/core-web-vitals")`, a string.
    "eslint-config-next",
    // Run as a binary by `pnpm db:lint`, never imported.
    "squawk-cli",
    // Inferred from `react-email`; the preview CLI does not need it, and stage
    // 02 settled that it is an internal shared library rather than a package
    // this repository should depend on.
    "@react-email/ui",
    // Both are inferred from app.json keys rather than from an import, and
    // neither resolves today: `expo export` and the jest suite pass without
    // them. `expo-system-ui` is the one to re-examine on the first device pass,
    // where `userInterfaceStyle` is actually rendered.
    "expo-updates",
    "expo-system-ui",
  ],
  ignoreUnresolved: [
    // The `plugins: [{ name: "next" }]` entry in the shared Next.js tsconfig
    // names a language-service plugin, resolved by the app that extends it.
    "next",
  ],
  workspaces: {
    ".": {
      // The root holds only configuration; every command lives in the tooling
      // package and is reached as a bin, not an import.
      project: ["*.{js,cjs,ts}"],
    },
    "apps/mobile": {
      // expo-router builds the route tree from the file system, so no module
      // imports a screen.
      entry: ["src/app/**/*.{ts,tsx}", "*.config.{js,cjs}"],
    },
    "apps/web": {
      entry: ["e2e/**/*.spec.ts", "scripts/*.ts"],
    },
    "packages/config": {
      // Every file here is configuration another workspace loads by path, so
      // the package is entirely its own entry point.
      entry: ["eslint/*.js", "vitest/*.ts", "*.js"],
      project: ["**/*.{js,ts}"],
    },
    "packages/tooling": {
      // Every repository command is a bin nothing imports.
      entry: ["src/bin/*.ts"],
    },
  },
};

export default config;
