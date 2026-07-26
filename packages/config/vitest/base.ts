import { defineConfig, type ViteUserConfig } from "vitest/config";

export const baseVitestConfig = defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
    passWithNoTests: true,
  },
});

export type CoverageFloor = {
  readonly branches: number;
  readonly functions: number;
  readonly lines: number;
  readonly statements: number;
};

/**
 * The base configuration with a coverage floor.
 *
 * The floor is the level a package already holds, not an aspiration: set that
 * way, it cannot be satisfied by code nobody exercises, and the only way to fail
 * it is to add some. `include` covers the whole source tree rather than only the
 * files a test happened to import — without it an untested module counts for
 * nothing, and a package could lose coverage by growing.
 *
 * `src/index.ts` is excluded because a barrel re-exports and decides nothing.
 */
export function coveredVitestConfig(floor: CoverageFloor): ViteUserConfig {
  return defineConfig({
    test: {
      ...baseVitestConfig.test,
      coverage: {
        ...baseVitestConfig.test?.coverage,
        exclude: ["src/**/*.test.ts", "src/index.ts"],
        include: ["src/**/*.ts"],
        provider: "v8",
        thresholds: { ...floor },
      },
    },
  });
}
