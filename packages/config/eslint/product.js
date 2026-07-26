/**
 * The two conventions the batteries stages established and left to review.
 *
 * Every colour comes from `packages/tokens` (stage 03) and every user-facing
 * string comes from both message catalogs (stage 04). Both were real rules the
 * whole time and neither was enforced, so the only thing standing between a
 * product and a hardcoded hex or an untranslated sentence was whoever read the
 * diff. These selectors are what read it now.
 *
 * Deliberately written as `no-restricted-syntax` rather than pulled from a React
 * plugin: the two applications load different plugin sets (Next's config on web,
 * Expo's on native), and a rule defined in one namespace cannot be shared
 * without redefining a plugin in the other. Syntax selectors work identically in
 * both, and the message is ours to write.
 */

/** A literal that carries a colour a designer chose instead of a token. */
const rawColourValue =
  "Literal[value=/#[0-9a-fA-F]{3,8}\\b|\\brgba?\\(|\\bhsla?\\(|\\boklch\\(/]";

/** A Tailwind utility naming a palette colour rather than a semantic one. */
const paletteUtility =
  "Literal[value=/\\b(bg|text|border|ring|from|via|to|fill|stroke|outline|decoration|shadow|caret|accent|divide|placeholder)-(white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-[0-9]{2,3})?\\b/]";

import { suppressionSyntax } from "./rules.js";

/** Attributes whose value a person reads or hears, not an identifier. */
const spokenAttributes =
  "JSXAttribute[name.name=/^(alt|title|placeholder|aria-label|accessibilityLabel|accessibilityHint)$/] > Literal";

const colourMessage =
  "Colours come from `packages/tokens`. Use a semantic utility (`bg-background`, `text-muted-foreground`) on web or `useTheme()` on native; add a new semantic key to both palettes if none fits.";

const copyMessage =
  'User-facing text lives in both message catalogs. Render it through `t("key")` and add the key to `packages/i18n/messages/en.json` and `nl.json`.';

/**
 * Rules for product UI — the two applications' `src/` trees. Not for tests: a
 * test legitimately renders a literal to prove a component shows what it was
 * given, and a hex in a fixture is data rather than design.
 *
 * @type {import("eslint").Linter.RulesRecord}
 */
export const productUiRules = {
  "no-restricted-syntax": [
    "error",
    // ESLint replaces a rule's options rather than merging them, so the base
    // suppression selectors have to be restated here or these files lose them.
    ...suppressionSyntax,
    { message: colourMessage, selector: rawColourValue },
    { message: colourMessage, selector: paletteUtility },
    // Whitespace-only JSX text is layout, not copy, so the selector requires a
    // visible character — which is also why punctuation around a translated
    // string is caught: a locale may not punctuate the way English does.
    { message: copyMessage, selector: "JSXText[value=/[^\\s]/]" },
    { message: copyMessage, selector: spokenAttributes },
  ],
};
