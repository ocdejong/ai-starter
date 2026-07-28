import { type FeatureNames } from "./naming.ts";
import { catalogNamespace, type FeatureShape } from "./shape.ts";

function object(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`The catalog has no "${path}" object to extend.`);
  }
  return value as Record<string, unknown>;
}

/**
 * Adds the feature's namespace and its navigation label to one catalog.
 *
 * Both locales get the same English copy, because a generator cannot translate a
 * product's own noun. That leaves the Dutch file correct-but-untranslated, so the
 * generator says so in a follow-up *and* `pnpm policy` fails on every value that
 * still reads as English — a printed instruction nobody has to notice is how the
 * Dutch stayed English through a whole cold-agent run.
 */
export function addFeatureNamespace(
  catalog: string,
  names: FeatureNames,
  shape: FeatureShape,
): string {
  const parsed: unknown = JSON.parse(catalog);
  const root = object(parsed, "the catalog");
  const app = object(root.app, "app");

  // Both writes leave an existing value alone. The namespace always did; the
  // navigation label did not, so `pnpm generate feature <existing>` — the
  // command `README.md` names for putting a deleted slice back — replaced a
  // translated label with the English one. Nothing failed, because the
  // idempotency test's fixture is untranslated and a rewrite there is a no-op.
  object(app.nav, "app.nav")[names.camelPlural] ??= names.titlePlural;
  app[names.camelPlural] ??= catalogNamespace(names, shape);

  return `${JSON.stringify(root, null, 2)}\n`;
}

/** Removes the feature's namespace and its navigation label from one catalog. */
export function removeFeatureNamespace(
  catalog: string,
  names: FeatureNames,
): string {
  const parsed: unknown = JSON.parse(catalog);
  const root = object(parsed, "the catalog");
  const app = object(root.app, "app");

  delete object(app.nav, "app.nav")[names.camelPlural];
  delete app[names.camelPlural];

  return `${JSON.stringify(root, null, 2)}\n`;
}
