/**
 * Ways to make the type checker agree with code it cannot vouch for, and ways
 * to make a suite report a pass it did not earn. `recommendedTypeChecked`
 * already rejects `any` and every unsafe operation on one; these close what it
 * leaves open. Each is proven by a planted violation in `rules.test.ts`.
 *
 * Exported because ESLint replaces a rule's options rather than merging them:
 * any config that sets `no-restricted-syntax` again must spread these back in,
 * or the files it covers quietly lose them.
 */
export const suppressionSyntax = [
  {
    // `x as unknown as T` asserts between two unrelated types by laundering
    // through `unknown`, which is exactly the check `as` alone would have made.
    message:
      "Do not launder an assertion through `unknown`. Narrow with a type guard, parse with Zod, or fix the type the value really has.",
    selector:
      'TSAsExpression > TSAsExpression[typeAnnotation.type="TSUnknownKeyword"]',
  },
  {
    // A skipped or focused test reports a pass the suite never ran, and nothing
    // else in the harness can tell the difference.
    message:
      "Do not disable or focus a test. Fix it, or delete it and say so in the commit.",
    selector:
      "MemberExpression[object.name=/^(it|test|describe)$/][property.name=/^(only|skip|todo)$/]",
  },
  {
    message:
      "Do not disable a test. Fix it, or delete it and say so in the commit.",
    selector: "CallExpression[callee.name=/^x(it|test|describe)$/]",
  },
];

/** @type {import("eslint").Linter.RulesRecord} */
export const typescriptRules = {
  "@typescript-eslint/array-type": "off",
  // An object literal asserted into a type is checked for nothing it omits, so
  // it is the one assertion that silently invents data.
  "@typescript-eslint/consistent-type-assertions": [
    "error",
    { assertionStyle: "as", objectLiteralTypeAssertions: "never" },
  ],
  "@typescript-eslint/consistent-type-definitions": "off",
  "@typescript-eslint/consistent-type-imports": [
    "error",
    { prefer: "type-imports", fixStyle: "inline-type-imports" },
  ],
  "@typescript-eslint/no-floating-promises": "error",
  "@typescript-eslint/no-misused-promises": [
    "error",
    { checksVoidReturn: { attributes: false } },
  ],
  "@typescript-eslint/no-non-null-assertion": "error",
  "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  "@typescript-eslint/require-await": "off",
  "@typescript-eslint/switch-exhaustiveness-check": "error",
  // A caught error that is neither handled nor recorded turns a failure into a
  // silent success, which is the hardest kind of bug to find later.
  "no-empty": ["error", { allowEmptyCatch: false }],
  "no-restricted-syntax": ["error", ...suppressionSyntax],
};
