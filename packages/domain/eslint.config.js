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
              message: "Domain code is dependency-free.",
            },
            { name: "@t3-test/db", message: "Domain code is dependency-free." },
            { name: "expo", message: "Domain code is platform-independent." },
            { name: "next", message: "Domain code is platform-independent." },
            { name: "react", message: "Domain code is framework-independent." },
            {
              name: "react-native",
              message: "Domain code is platform-independent.",
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
              message: "Domain code must stay portable across runtimes.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.name='process'][property.name='env']",
          message:
            "Inject configuration; do not read process.env in domain code.",
        },
      ],
    },
  },
];
