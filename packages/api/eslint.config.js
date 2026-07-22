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
          paths: [
            { name: "expo", message: "The API package is server-only." },
            { name: "next", message: "Keep framework adapters in apps/web." },
            { name: "react", message: "The API package is server-only." },
            {
              name: "react-native",
              message: "The API package is server-only.",
            },
          ],
          patterns: [
            {
              group: ["expo/*", "next/*", "react-native/*"],
              message: "Keep platform dependencies out of the shared API.",
            },
          ],
        },
      ],
    },
  },
];
