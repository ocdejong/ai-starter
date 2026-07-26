import { productUiRules } from "@ai-starter/config/eslint/product";
import { typescriptRules } from "@ai-starter/config/eslint/rules";
import { defineConfig } from "eslint/config";
import expoConfig from "eslint-config-expo/flat.js";

export default defineConfig([
  {
    ignores: [".expo/**", "dist/**"],
  },
  {
    files: ["*.config.cjs"],
    languageOptions: {
      globals: {
        __dirname: "readonly",
        module: "readonly",
        require: "readonly",
      },
    },
  },
  expoConfig,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    // This app composes Expo's config rather than the shared base, so the
    // linter options the base sets have to be restated here.
    linterOptions: { reportUnusedDisableDirectives: "error" },
    rules: typescriptRules,
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/**/*.test.{ts,tsx}", "src/test/**"],
    rules: productUiRules,
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@ai-starter/api",
              message:
                "Mobile may import only public client types from @ai-starter/api/client.",
            },
            {
              name: "@ai-starter/db",
              message: "Database code is server-only.",
            },
            { name: "next", message: "Next.js modules are web-only." },
            {
              name: "server-only",
              message: "Server-only modules cannot run in React Native.",
            },
          ],
          patterns: [
            {
              group: ["@ai-starter/db/*", "next/*"],
              message: "This module is unavailable in the mobile runtime.",
            },
          ],
        },
      ],
    },
  },
]);
