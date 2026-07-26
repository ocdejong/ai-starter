/**
 * Graph-wide architecture rules. ESLint's per-file no-restricted-imports encodes
 * the same directions locally; this catches what a single file cannot see: cycles
 * and reachability across the whole module graph. `docs/architecture.md` is the
 * source these encode. Every rule's comment names the fix, not just the rule.
 *
 * `pnpm arch` runs this over `apps packages`. Resolution reads `tsconfig.depcruise.json`
 * so the web `~/*` and mobile `@/*` path aliases follow to real files; without it the
 * intra-app graph would dead-end and cycles could hide. The same rules are re-run
 * against planted fixtures by `packages/tooling/src/dependency-cruiser.test.ts`, so a
 * rule that silently stops matching is a failing test.
 */
const workspace = "@ai-starter";

/** Platform/runtime imports that must never appear in platform-neutral packages. */
const platform = [
  "^(next|next/.*)$",
  "^(expo|expo/.*|expo-.*)$",
  "^(react|react-dom|react-native|react-native/.*)$",
];

module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment:
        "This import completes a dependency cycle. Extract the shared piece into a module both sides depend on.",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-deep-package-imports",
      severity: "error",
      comment:
        "Reach another workspace package through its public entry (its exports map), never its src internals.",
      from: { path: "^(apps|packages)/" },
      to: { path: `${workspace}/[a-z-]+/src` },
    },
    {
      name: "domain-stays-platform-neutral",
      severity: "error",
      comment:
        "packages/domain holds deterministic rules only. Move framework, persistence or transport code to an adapter.",
      from: { path: "^packages/domain/src" },
      to: {
        path: [
          `${workspace}/(api|db|tokens)`,
          "^@prisma/",
          "^better-auth",
          ...platform,
        ],
      },
    },
    {
      name: "tokens-stay-plain-data",
      severity: "error",
      comment:
        "packages/tokens is cross-platform plain values. It must not import another package or a runtime.",
      from: { path: "^packages/tokens/src" },
      to: { path: [`${workspace}/(api|db|domain)`, "^@prisma/", ...platform] },
    },
    {
      name: "db-stays-below-the-api",
      severity: "error",
      comment:
        "packages/db is server-only persistence. It must not reach the API layer or any UI framework.",
      from: { path: "^packages/db/src" },
      to: { path: [`${workspace}/(api|domain|tokens)`, ...platform] },
    },
    {
      name: "api-stays-framework-free",
      severity: "error",
      comment:
        "packages/api is transport- and vendor-neutral. Keep Prisma, provider SDKs and UI frameworks in apps/web adapters.",
      from: { path: "^packages/api/src" },
      to: { path: [`${workspace}/db`, "^@prisma/", ...platform] },
    },
    {
      name: "mobile-uses-only-the-api-client",
      severity: "error",
      comment:
        "apps/mobile may import only the public client types from @ai-starter/api/client, never the server API or the database.",
      from: { path: "^apps/mobile/src" },
      to: {
        path: [`${workspace}/db`, "^server-only$", "^(next|next/.*)$"],
      },
    },
    {
      name: "mobile-api-is-client-entry-only",
      severity: "error",
      comment:
        "Import @ai-starter/api/client from mobile; the bare @ai-starter/api entry is the server composition surface.",
      from: { path: "^apps/mobile/src" },
      to: { path: `${workspace}/api$` },
    },
    {
      name: "web-ui-and-transport-avoid-the-database",
      severity: "error",
      comment:
        "UI and tRPC code must reach the database through server modules or a procedure, never @ai-starter/db directly.",
      from: { path: "^apps/web/src/(app|trpc)/" },
      to: { path: `${workspace}/db` },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    // Generated and reported-on output, none of it part of the module graph.
    // A directory a tool is still writing is worse than noise: depcruise opens a
    // file that has since been replaced and dies with an ENOENT that names the
    // report, not the graph — which is how a coverage run in one package could
    // fail the architecture check in another.
    exclude: {
      path:
        "(^|/)(node_modules|generated|coverage|reports|test-results|playwright-report" +
        "|\\.next|\\.expo|\\.stryker-tmp|\\.turbo|dist)/",
    },
    tsConfig: { fileName: "tsconfig.depcruise.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".ts", ".tsx", ".js", ".jsx", ".json", ".css"],
    },
  },
};
