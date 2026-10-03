import { FlatCompat } from "@eslint/eslintrc";
import baseConfig from "@ai-starter/config/eslint/base";
import { productUiRules } from "@ai-starter/config/eslint/product";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const config = [
  {
    // Browser reports contain Playwright's bundled viewer, not application code.
    ignores: [
      ".next/**",
      "next-env.d.ts",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  ...compat.extends("next/core-web-vitals"),
  ...baseConfig,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/**/*.test.{ts,tsx}", "src/test/**"],
    rules: productUiRules,
  },
  {
    files: ["src/app/**/*.{ts,tsx}", "src/trpc/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@ai-starter/db",
              message:
                "UI and transport code must reach the database through server modules or tRPC.",
            },
          ],
          patterns: [
            {
              group: ["@ai-starter/db/*"],
              message:
                "UI and transport code must not import database internals.",
            },
          ],
        },
      ],
    },
  },
];

export default config;
