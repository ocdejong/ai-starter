import baseConfig from "@t3-test/config/eslint/base";

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
];
