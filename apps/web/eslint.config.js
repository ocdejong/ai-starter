import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import baseConfig from "@ai-starter/config/eslint/base";
import { productUiRules } from "@ai-starter/config/eslint/product";

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
  ...nextCoreWebVitals,
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
