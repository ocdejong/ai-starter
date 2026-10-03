import tseslint from "typescript-eslint";

import { typescriptRules } from "./rules.js";

const baseConfig = tseslint.config({
  files: ["**/*.ts", "**/*.tsx"],
  extends: [
    ...tseslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
  ],
  // A disable comment that no longer suppresses anything is a claim about the
  // code that stopped being true, and `pnpm policy` only checks that a disable
  // carries a justification — not that it still has a rule to silence. ESLint
  // reports these as warnings by default, and a warning fails nothing.
  linterOptions: {
    reportUnusedDisableDirectives: "error",
  },
  rules: typescriptRules,
});

export default baseConfig;
