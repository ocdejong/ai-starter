import { fileURLToPath } from "node:url";

import { baseVitestConfig } from "@ai-starter/config/vitest/base";
import { configDefaults, defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  baseVitestConfig,
  defineConfig({
    test: {
      alias: {
        // The auth factory reaches the `server-only`-marked database client;
        // Next aliases that marker away in its build and this mirrors it for
        // vitest. It touches only the marker, never real database code.
        "server-only": fileURLToPath(
          new URL("./test/server-only-stub.ts", import.meta.url),
        ),
      },
      exclude: [...configDefaults.exclude, "**/*.integration.test.ts"],
    },
  }),
);
