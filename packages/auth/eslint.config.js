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
            { name: "next", message: "Keep framework adapters in apps/web." },
            {
              name: "react",
              message: "The auth factory is a server package.",
            },
            {
              name: "react-native",
              message: "The auth factory is a server package.",
            },
          ],
          patterns: [
            {
              group: ["next/*", "react-native/*"],
              message: "Keep platform adapters out of the auth factory.",
            },
          ],
        },
      ],
    },
  },
];
