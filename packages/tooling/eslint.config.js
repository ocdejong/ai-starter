import baseConfig from "@ai-starter/config/eslint/base";

export default [
  ...baseConfig,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@ai-starter/api",
                "@ai-starter/api/*",
                "@ai-starter/db",
                "@ai-starter/db/*",
                "@ai-starter/domain",
                "@ai-starter/domain/*",
                "@ai-starter/tokens",
                "@ai-starter/tokens/*",
              ],
              message:
                "Repository tooling must not depend on product code; it runs before dependencies exist.",
            },
          ],
        },
      ],
    },
  },
];
