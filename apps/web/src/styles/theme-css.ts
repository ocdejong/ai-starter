import { colors, radius } from "@ai-starter/tokens";

/**
 * Renders the web theme stylesheet from the token source of truth.
 *
 * `packages/tokens` owns the values; this turns them into the `:root`/`.dark`
 * custom-property blocks Tailwind maps to utilities. `scripts/generate-theme-css.ts`
 * writes the result to `theme.generated.css`, and `theme-css.test.ts` fails when
 * the committed file drifts from this output, so the tokens stay the one source.
 */
export const generatedThemeCssPath = "src/styles/theme.generated.css";

const header = `/* Generated from packages/tokens by \`pnpm --filter @ai-starter/web theme:generate\`.
   Do not edit by hand; edit the tokens and regenerate. */`;

function declarations(scheme: Record<string, string>): string {
  return Object.entries(scheme)
    .map(([name, value]) => `  --${name}: ${value};`)
    .join("\n");
}

export function renderThemeCss(): string {
  const root = `${declarations(colors.light)}\n  --radius: ${radius}rem;`;

  return `${header}

:root {
${root}
}

.dark {
${declarations(colors.dark)}
}
`;
}
