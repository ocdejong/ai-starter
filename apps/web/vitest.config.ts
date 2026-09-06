import { fileURLToPath } from "node:url";

import { baseVitestConfig } from "@ai-starter/config/vitest/base";
import react from "@vitejs/plugin-react";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  baseVitestConfig,
  defineConfig({
    plugins: [react()],
    resolve: {
      alias: {
        // Server modules under test carry the `server-only` marker; Next aliases
        // it away in its build and this mirrors it for vitest.
        "server-only": fileURLToPath(
          new URL("./src/test/server-only-stub.ts", import.meta.url),
        ),
        "~": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: "server",
            environment: "node",
            include: ["src/**/*.test.ts"],
          },
        },
        {
          extends: true,
          test: {
            name: "components",
            environment: "jsdom",
            include: ["src/**/*.test.tsx"],
            setupFiles: ["./src/test/setup.ts"],
          },
        },
      ],
    },
  }),
);
