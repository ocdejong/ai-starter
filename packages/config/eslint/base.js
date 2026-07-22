import tseslint from "typescript-eslint";

import { typescriptRules } from "./rules.js";

const baseConfig = tseslint.config({
  files: ["**/*.ts", "**/*.tsx"],
  extends: [
    ...tseslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
  ],
  rules: typescriptRules,
});

export default baseConfig;
