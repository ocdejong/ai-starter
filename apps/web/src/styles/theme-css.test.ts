import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { generatedThemeCssPath, renderThemeCss } from "./theme-css";

const committedCss = resolve(process.cwd(), generatedThemeCssPath);

describe("generated theme CSS", () => {
  it("matches the tokens (regenerate with pnpm --filter @ai-starter/web theme:generate)", () => {
    const onDisk = readFileSync(committedCss, "utf8");

    expect(onDisk).toBe(renderThemeCss());
  });

  it("emits a variable for every semantic token in both schemes", () => {
    const css = renderThemeCss();

    for (const name of ["background", "muted-foreground", "sidebar-ring"]) {
      expect(css).toContain(`--${name}:`);
    }
    expect(css).toContain("--radius:");
    expect(css).toContain(".dark {");
  });
});
