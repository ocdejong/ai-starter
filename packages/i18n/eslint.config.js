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
    files: ["src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next",
              message: "Shared catalogs must stay platform-neutral.",
            },
            {
              name: "next-intl",
              message:
                "next-intl is web-only; keep it in apps/web. This package holds the catalogs both platforms share.",
            },
            {
              name: "react",
              message: "Shared catalogs must be plain data plus pure helpers.",
            },
            {
              name: "react-native",
              message: "Shared catalogs must stay platform-neutral.",
            },
          ],
          patterns: [
            {
              group: ["expo", "expo/*", "expo-*", "next/*", "react-native/*"],
              message:
                "Shared catalogs must stay portable across web and native runtimes.",
            },
          ],
        },
      ],
    },
  },
];
