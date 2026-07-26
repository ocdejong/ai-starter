import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { type FeatureNames } from "./naming.ts";

/** Where the template trees live, relative to this module. */
export const templateRoot = path.resolve(
  import.meta.dirname,
  "..",
  "..",
  "templates",
);

export const templateSuffix = ".template";

/**
 * Substitutes `{{token}}` placeholders. An unknown token is an error rather than
 * an empty string: a typo in a template would otherwise reach a generated file
 * and only surface as a syntax error in someone else's checkout.
 */
export function renderTemplate(source: string, names: FeatureNames): string {
  return source.replace(/\{\{(\w+)\}\}/g, (_match, token: string) => {
    const value = (names as unknown as Record<string, string | undefined>)[
      token
    ];
    if (value === undefined) {
      throw new Error(
        `Template placeholder "{{${token}}}" is not a name form. Known forms: ${Object.keys(names).sort().join(", ")}.`,
      );
    }
    return value;
  });
}

function templateFiles(directory: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...templateFiles(absolute));
    } else if (entry.isFile() && entry.name.endsWith(templateSuffix)) {
      found.push(absolute);
    }
  }

  return found;
}

/**
 * Renders one template tree into `{ repository-relative path: content }`.
 *
 * Placeholders appear in the paths as well as the bodies, so the tree under
 * `templates/` mirrors the repository a generated feature lands in — which is
 * what lets a reader see where a file will go without running anything.
 */
export function renderTree(
  kind: string,
  names: FeatureNames,
): Map<string, string> {
  const root = path.join(templateRoot, kind);
  if (!statSync(root, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`No template tree at ${root}.`);
  }

  const rendered = new Map<string, string>();

  for (const absolute of templateFiles(root).sort()) {
    const relative = path
      .relative(root, absolute)
      .split(path.sep)
      .join("/")
      .slice(0, -templateSuffix.length);
    rendered.set(
      renderTemplate(relative, names),
      renderTemplate(readFileSync(absolute, "utf8"), names),
    );
  }

  return rendered;
}
