import { definePlugin, defineRule } from "vite-plus/lint/plugins";

/**
 * The repository's own lint rules: the conventions no upstream rule encodes.
 *
 * Each rule is a set of AST selectors with the message a reader sees. They were
 * `no-restricted-syntax` entries under ESLint, which Oxlint does not implement
 * natively; as plugin rules they also get a name of their own, so a disable
 * comment has to say which convention it is setting aside. Each is proven by a
 * planted violation in `plugin.test.ts` and again through the real config in
 * `config.test.ts`.
 *
 * @param {string} description
 * @param {readonly { selector: string; message: string }[]} entries
 */
function restrictedSyntax(description, entries) {
  return defineRule({
    meta: { docs: { description }, type: "problem" },
    create(context) {
      return Object.fromEntries(
        entries.map(({ message, selector }) => [
          selector,
          (node) => {
            context.report({ message, node });
          },
        ]),
      );
    },
  });
}

/**
 * `x as unknown as T` asserts between two unrelated types by laundering through
 * `unknown`, which is exactly the check `as` alone would have made.
 */
const noLaunderedAssertion = restrictedSyntax(
  "Disallow asserting through `unknown`.",
  [
    {
      message:
        "Do not launder an assertion through `unknown`. Narrow with a type guard, parse with Zod, or fix the type the value really has.",
      selector:
        'TSAsExpression > TSAsExpression[typeAnnotation.type="TSUnknownKeyword"]',
    },
  ],
);

/**
 * A skipped or focused test reports a pass the suite never ran, and nothing
 * else in the harness can tell the difference.
 */
const noDisabledTest = restrictedSyntax(
  "Disallow skipped, focused and expected-to-fail tests.",
  [
    {
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
    {
      // Playwright nests its group under the runner (`test.describe.skip`), so
      // the object of the member expression is another member expression and
      // the first selector — which reads `object.name` — never sees it. Its
      // own `fixme` spelling is invisible to that selector too.
      message:
        "Do not disable or focus a browser or native journey. Fix it, or delete it and say so in the commit.",
      selector:
        "MemberExpression[object.object.name='test'][object.property.name='describe'][property.name=/^(only|skip|todo|fixme)$/]",
    },
    {
      message:
        "Do not mark a journey as expected to fail. Fix it, or delete it and say so in the commit.",
      selector:
        "MemberExpression[object.name=/^(it|test)$/][property.name='fixme']",
    },
  ],
);

/** A literal that carries a colour a designer chose instead of a token. */
const rawColourValue =
  "Literal[value=/#[0-9a-fA-F]{3,8}\\b|\\brgba?\\(|\\bhsla?\\(|\\boklch\\(/]";

/** A Tailwind utility naming a palette colour rather than a semantic one. */
const paletteUtility =
  "Literal[value=/\\b(bg|text|border|ring|from|via|to|fill|stroke|outline|decoration|shadow|caret|accent|divide|placeholder)-(white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-[0-9]{2,3})?\\b/]";

const colourMessage =
  "Colours come from `packages/tokens`. Use a semantic utility (`bg-background`, `text-muted-foreground`) on web or `useTheme()` on native; add a new semantic key to both palettes if none fits.";

/** Every colour in product UI comes from `packages/tokens`. */
const noRawColour = restrictedSyntax(
  "Require design-token colours in product UI.",
  [
    { message: colourMessage, selector: rawColourValue },
    { message: colourMessage, selector: paletteUtility },
  ],
);

/** Attributes whose value a person reads or hears, not an identifier. */
const spokenAttributes =
  "JSXAttribute[name.name=/^(alt|title|placeholder|aria-label|accessibilityLabel|accessibilityHint)$/] > Literal";

const copyMessage =
  'User-facing text lives in both message catalogs. Render it through `t("key")` and add the key to `packages/i18n/messages/en.json` and `nl.json`.';

/** Every string a person reads comes from both message catalogs. */
const noLiteralCopy = restrictedSyntax(
  "Require translated copy in product UI.",
  [
    // Whitespace-only JSX text is layout, not copy, so the selector requires a
    // visible character — which is also why punctuation around a translated
    // string is caught: a locale may not punctuate the way English does.
    { message: copyMessage, selector: "JSXText[value=/[^\\s]/]" },
    { message: copyMessage, selector: spokenAttributes },
  ],
);

/** Pure code takes its configuration as input. */
const noProcessEnv = restrictedSyntax(
  "Disallow reading process.env in platform-neutral packages.",
  [
    {
      message:
        "Inject configuration; do not read process.env in domain code or design tokens.",
      selector: "MemberExpression[object.name='process'][property.name='env']",
    },
  ],
);

/**
 * Expo inlines `process.env.EXPO_PUBLIC_*` at build time by matching the whole
 * member expression, so a computed key or a destructured binding ships
 * `undefined`. Ported from `eslint-plugin-expo`, which would otherwise keep
 * ESLint itself in the dependency tree for two selectors.
 */
const noUninlinableEnv = restrictedSyntax(
  "Require statically inlinable environment reads in Expo code.",
  [
    {
      message:
        "Read `process.env.EXPO_PUBLIC_NAME` with a literal property name; Expo cannot inline a computed key.",
      selector:
        "MemberExpression[computed=true][object.type='MemberExpression'][object.object.name='process'][object.property.name='env']",
    },
    {
      message:
        "Do not destructure `process.env`; Expo inlines only `process.env.EXPO_PUBLIC_NAME` written out in full.",
      selector:
        "VariableDeclarator[id.type='ObjectPattern'][init.type='MemberExpression'][init.object.name='process'][init.property.name='env']",
    },
  ],
);

export default definePlugin({
  meta: { name: "guard" },
  rules: {
    "no-disabled-test": noDisabledTest,
    "no-laundered-assertion": noLaunderedAssertion,
    "no-literal-copy": noLiteralCopy,
    "no-process-env": noProcessEnv,
    "no-raw-colour": noRawColour,
    "no-uninlinable-env": noUninlinableEnv,
  },
});
