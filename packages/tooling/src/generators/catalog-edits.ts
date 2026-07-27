import { type FeatureNames } from "./naming.ts";

/**
 * The catalog namespace a generated feature ships, in the language the templates
 * assert against.
 *
 * Copy is written so it survives having a product's own noun substituted into
 * it: no indefinite articles, because "an release note" is how a generator gives
 * itself away, and the two title fields are labelled apart because a screen with
 * two fields both called "Title" is ambiguous to a reader and to a test.
 */
function featureCatalogNamespace(names: FeatureNames): Record<string, unknown> {
  return {
    title: names.titlePlural,
    description: `${names.titlePlural} belong to the group you are working in. Switch groups and you are looking at another set.`,
    loading: `Loading ${names.lowerPlural}…`,
    count: `{count, plural, =0 {No ${names.lowerPlural} yet} one {# ${names.lower}} other {# ${names.lowerPlural}}}`,
    current: {
      title: `Current ${names.lower}`,
      empty: "This group has not published anything yet.",
      label: "Current title",
      submit: "Save",
      submitting: "Saving…",
      saved: "Saved.",
    },
    publish: {
      title: `New ${names.lower}`,
      description: `Publishing supersedes the current ${names.lower}.`,
      label: "New title",
      submit: "Publish",
      submitting: "Publishing…",
    },
    earlier: {
      title: `Earlier ${names.lowerPlural}`,
      empty: "Nothing has been superseded yet.",
    },
    errors: {
      network:
        "The server could not be reached. Check your connection and try again.",
      unexpected: "Something went wrong. Please try again.",
    },
    validation: {
      [`${names.camel}TitleRequired`]: "Enter a title.",
      [`${names.camel}TitleTooLong`]: "Use {max} characters or fewer.",
    },
  };
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`The catalog has no "${path}" object to extend.`);
  }
  return value as Record<string, unknown>;
}

/**
 * Adds the feature's namespace and its navigation label to one catalog.
 *
 * Both locales get the same English copy: a generator cannot translate a
 * product's own noun, and the catalogs' parity test compares keys and ICU
 * arguments rather than words — so the Dutch file is left correct-but-untranslated
 * and the generator says so.
 */
export function addFeatureNamespace(
  catalog: string,
  names: FeatureNames,
): string {
  const parsed: unknown = JSON.parse(catalog);
  const root = object(parsed, "the catalog");
  const app = object(root.app, "app");

  object(app.nav, "app.nav")[names.camelPlural] = names.titlePlural;
  app[names.camelPlural] ??= featureCatalogNamespace(names);

  return `${JSON.stringify(root, null, 2)}\n`;
}
