import { baseVitestConfig } from "@t3-test/config/vitest/base";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  baseVitestConfig,
  defineConfig({
    test: {
      fileParallelism: false,
      include: ["src/**/*.integration.test.ts"],
      testTimeout: 30_000,
    },
  }),
);
