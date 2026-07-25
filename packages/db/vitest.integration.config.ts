import { fileURLToPath } from "node:url";

import { baseVitestConfig } from "@ai-starter/config/vitest/base";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  baseVitestConfig,
  defineConfig({
    test: {
      alias: {
        // The adapters under test carry the `server-only` marker; Next aliases
        // it away in its build, and this mirrors that for vitest.
        "server-only": fileURLToPath(
          new URL("./test/server-only-stub.ts", import.meta.url),
        ),
      },
      fileParallelism: false,
      include: ["src/**/*.integration.test.ts"],
      testTimeout: 30_000,
    },
  }),
);
