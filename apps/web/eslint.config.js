import { FlatCompat } from "@eslint/eslintrc";
import baseConfig from "@ai-starter/config/eslint/base";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const config = [
  {
    ignores: [".next/**", "next-env.d.ts"],
  },
  ...compat.extends("next/core-web-vitals"),
  ...baseConfig,
  {
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
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
