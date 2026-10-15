import { lintConfig } from "@ai-starter/config/lint";
import { defineConfig } from "vite-plus";

/**
 * The workspace's one Vite+ configuration. `vp fmt`, `vp lint` and `vp check`
 * read their settings from this file alone, whichever package they run in, so
 * per-package differences are overrides inside these blocks rather than files
 * of their own.
 */
export default defineConfig({
  lint: lintConfig,
  fmt: {
    printWidth: 80,
    sortPackageJson: false,
    sortTailwindcss: {},
    ignorePatterns: [
      ".claude",
      ".expo",
      ".next",
      "coverage",
      "dist",
      "node_modules",
      "packages/db/generated",
      "apps/web/src/styles/theme.generated.css",
      "pnpm-lock.yaml",
    ],
  },
});
