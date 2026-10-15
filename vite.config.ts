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
  run: {
    // Package scripts run uncached, on purpose. A cached task receives only
    // the environment variables its cache config names, and a change to one it
    // does not name replays the old output — measured here: an undeclared
    // `DATABASE_URL` reached a cached script as `undefined`, and changing it
    // was still a cache hit. Caching a build is a decision that comes with its
    // environment list, task by task.
    cache: false,
  },
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
