import { typescriptRules } from "@t3-test/config/eslint/rules";
import { defineConfig } from "eslint/config";
import expoConfig from "eslint-config-expo/flat.js";

export default defineConfig([
  {
    ignores: [".expo/**", "dist/**"],
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
]);
