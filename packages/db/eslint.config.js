import baseConfig from "@ai-starter/config/eslint/base";

export default [
  { ignores: ["generated/**"] },
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
          paths: [
            {
              name: "@ai-starter/api",
              message: "The database is below the API layer.",
            },
            { name: "expo", message: "The database package is server-only." },
            { name: "next", message: "Keep framework adapters in apps/web." },
            { name: "react", message: "The database package is server-only." },
            {
              name: "react-native",
              message: "The database package is server-only.",
            },
          ],
          patterns: [
            {
              group: [
                "@ai-starter/api/*",
                "expo/*",
                "next/*",
                "react-native/*",
              ],
              message: "The database package must not depend on higher layers.",
            },
          ],
        },
      ],
    },
  },
];
