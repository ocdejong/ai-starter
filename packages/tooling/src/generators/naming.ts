/**
 * Every form of a feature's name the templates need.
 *
 * Generated code has to read like code someone wrote: identifiers run the words
 * together, paths hyphenate them, and copy keeps the space. One derivation, in
 * one place, is what stops a template from inventing a fifth convention.
 */
export type FeatureNames = {
  /** `release-note` — file and directory names. */
  readonly kebab: string;
  readonly kebabPlural: string;
  /** `releaseNote` — variables and object keys. */
  readonly camel: string;
  readonly camelPlural: string;
  /** `ReleaseNote` — types, components and the Prisma model. */
  readonly pascal: string;
  readonly pascalPlural: string;
  /** `Release note` — headings and other copy. */
  readonly title: string;
  readonly titlePlural: string;
  /** `release note` — copy in the middle of a sentence. */
  readonly lower: string;
  readonly lowerPlural: string;
};

const namePattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** English plural of one word, covering the endings a product name hits. */
function pluralise(word: string): string {
  if (/[^aeiou]y$/.test(word)) {
    return `${word.slice(0, -1)}ies`;
  }
  if (/(?:s|x|z|ch|sh)$/.test(word)) {
    return `${word}es`;
  }
  return `${word}s`;
}

function capitalise(word: string): string {
  return `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`;
}

function forms(words: readonly string[]) {
  return {
    camel: words
      .map((word, index) => (index === 0 ? word : capitalise(word)))
      .join(""),
    kebab: words.join("-"),
    lower: words.join(" "),
    pascal: words.map(capitalise).join(""),
    title: capitalise(words.join(" ")),
  };
}

function requireName(value: string, label: string): string[] {
  if (!namePattern.test(value)) {
    throw new Error(
      `"${value}" is not a usable ${label}. Use one or more lower-case kebab-case words, such as "release-note".`,
    );
  }
  return value.split("-");
}

/**
 * Derives the naming for one feature.
 *
 * `plural` is only needed when English does not simply add a suffix — pass
 * `people` for `person`. The two must differ: several generated paths are the
 * singular and the plural side by side, and identical forms would collide.
 */
export function featureNames(singular: string, plural?: string): FeatureNames {
  const singularWords = requireName(singular, "feature name");
  const pluralWords =
    plural === undefined
      ? [
          ...singularWords.slice(0, -1),
          pluralise(singularWords.at(-1) ?? singular),
        ]
      : requireName(plural, "plural feature name");

  const one = forms(singularWords);
  const many = forms(pluralWords);

  if (one.kebab === many.kebab) {
    throw new Error(
      `The singular and plural of "${singular}" must differ; pass an explicit plural.`,
    );
  }

  return {
    camel: one.camel,
    camelPlural: many.camel,
    kebab: one.kebab,
    kebabPlural: many.kebab,
    lower: one.lower,
    lowerPlural: many.lower,
    pascal: one.pascal,
    pascalPlural: many.pascal,
    title: one.title,
    titlePlural: many.title,
  };
}
