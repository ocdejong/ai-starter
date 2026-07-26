import baseConfig from "@ai-starter/config/eslint/base";
import { suppressionSyntax } from "@ai-starter/config/eslint/rules";

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
              message: "Domain code is dependency-free.",
            },
            {
              name: "@ai-starter/db",
              message: "Domain code is dependency-free.",
            },
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
                "@ai-starter/api/*",
                "@ai-starter/db/*",
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
        // Restated, not merged: ESLint replaces a rule's options, so without
        // this the domain would silently lose the shared suppression rules.
        ...suppressionSyntax,
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
