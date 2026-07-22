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
            {
              name: "@ai-starter/api",
              message: "Design tokens are dependency-free.",
            },
            {
              name: "@ai-starter/db",
              message: "Design tokens are dependency-free.",
            },
            {
              name: "expo",
              message: "Design tokens are platform-independent.",
            },
            {
              name: "next",
              message: "Design tokens are platform-independent.",
            },
            { name: "react", message: "Design tokens must be plain data." },
            {
              name: "react-native",
              message: "Design tokens must be plain data.",
            },
          ],
          patterns: [
            {
              group: [
                "@ai-starter/api/*",
                "@ai-starter/db/*",
                "expo/*",
                "next/*",
                "react-native/*",
              ],
              message: "Design tokens must stay portable across runtimes.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.name='process'][property.name='env']",
          message: "Design tokens must not depend on environment state.",
        },
      ],
    },
  },
];
