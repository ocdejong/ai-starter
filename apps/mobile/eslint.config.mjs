import { typescriptRules } from "@t3-test/config/eslint/rules";
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
    rules: typescriptRules,
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@t3-test/api",
              message:
                "Mobile may import only public client types from @t3-test/api/client.",
            },
            { name: "@t3-test/db", message: "Database code is server-only." },
            { name: "next", message: "Next.js modules are web-only." },
            {
              name: "server-only",
              message: "Server-only modules cannot run in React Native.",
            },
          ],
          patterns: [
            {
              group: ["@t3-test/db/*", "next/*"],
              message: "This module is unavailable in the mobile runtime.",
            },
          ],
        },
      ],
    },
  },
]);
