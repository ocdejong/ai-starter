import { defineConfig } from "vitest/config";

export const baseVitestConfig = defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
    passWithNoTests: true,
  },
});
