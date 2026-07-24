import { fileURLToPath } from "node:url";

import { baseVitestConfig } from "@ai-starter/config/vitest/base";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  baseVitestConfig,
  defineConfig({
    test: {
      alias: {
        // The database client under test is marked `server-only`; Next aliases
        // that marker away in its build, and this mirrors it for vitest.
        "server-only": fileURLToPath(
          new URL("./test/server-only-stub.ts", import.meta.url),
        ),
      },
      fileParallelism: false,
      include: ["src/**/*.integration.test.ts"],
      testTimeout: 60_000,
    },
  }),
);
