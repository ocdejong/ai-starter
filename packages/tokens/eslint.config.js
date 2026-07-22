import baseConfig from "@t3-test/config/eslint/base";

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
              name: "@t3-test/api",
              message: "Design tokens are dependency-free.",
            },
            {
              name: "@t3-test/db",
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
                "@t3-test/api/*",
                "@t3-test/db/*",
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
