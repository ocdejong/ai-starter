import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import {
  addFeatureNamespace,
  removeFeatureNamespace,
} from "./catalog-edits.ts";
import { type FeatureNames } from "./naming.ts";
import {
  addPrismaField,
  addPrismaModel,
  removePrismaField,
  removePrismaModel,
} from "./prisma-edits.ts";
import { renderTree } from "./render.ts";
import {
  featureMigrationSql,
  type FeatureShape,
  portDeclaration,
  prismaModel,
  shapeOverlay,
} from "./shape.ts";
import {
  addObjectEntry,
  addSortedReexport,
  insertAfterLine,
  insertBeforeLine,
  mergeBraceList,
  removeBraceListNames,
  removeDeclaration,
  removeJsxElementContaining,
  removeLinesContaining,
  removeObjectEntry,
  removeObjectLiteralContaining,
  removeReexport,
} from "./source-edits.ts";

export type RegistryEdit = {
  /** Repository-relative file the feature has to register itself in. */
  readonly file: string;
  readonly apply: (
    content: string,
    names: FeatureNames,
    shape: FeatureShape,
  ) => string;
  /**
   * The registration removed again, matched by pattern rather than rebuilt from
   * what `apply` would write today.
   *
   * A product removing a generated slice has been living with it: renamed a
   * field, reworded a comment, added an entry beside it. Reversing by
   * reconstruction would silently skip exactly those registrations — the ones
   * somebody has touched — and leave the product referencing a slice that is no
   * longer there. It takes no shape for the same reason: what has to go is
   * identified by name.
   */
  readonly revert: (content: string, names: FeatureNames) => string;
};

const navigationAnchor = "A generated feature registers its section";
const tabAnchor = "A generated feature registers its tab";

/**
 * The blocks a feature contributes to a file it shares with every other feature.
 *
 * They are functions rather than literals inside the edits because two things
 * need the same text: the edit that writes it, and the check that the committed
 * example still *is* it. `packages/api/src/context.ts` drifted from the port the
 * generator emits — three reworded sentences — and nothing failed, because the
 * only guard was an idempotency marker that asks whether the type exists, not
 * whether it still says what the generator would say.
 */
function domainExports(names: FeatureNames): string {
  return [
    "export {",
    `  ${names.camel}TitlePolicy,`,
    `  ${names.camel}ValidationCodes,`,
    `  create${names.pascal}InputSchema,`,
    `  parse${names.pascal}ValidationCode,`,
    `  rename${names.pascal}InputSchema,`,
    `  type ${names.pascal}ValidationCode,`,
    `  type Create${names.pascal}Input,`,
    `  type Rename${names.pascal}Input,`,
    `} from "./${names.kebab}";`,
  ].join("\n");
}

function inertPortEntry(names: FeatureNames): string {
  return [
    `${names.camelPlural}: {`,
    `  create: absent("${names.camelPlural}", "create"),`,
    `  listByGroup: absent("${names.camelPlural}", "listByGroup"),`,
    `  rename: absent("${names.camelPlural}", "rename"),`,
    "},",
  ].join("\n");
}

function compositionRootWiring(names: FeatureNames): string {
  return [
    "// The port is declared by the API layer and satisfied here, at the one",
    "// place that may know both halves. Nothing above this file names Prisma.",
    `const ${names.camelPlural}: ${names.pascal}Repository =`,
    `  createPrisma${names.pascal}Repository(database);`,
    "",
  ].join("\n");
}

/**
 * Everything a feature has to be registered in, and how.
 *
 * This list is the executable half of the architecture: a slice is not a feature
 * until the domain exports it, the API layer declares its port and mounts its
 * router, the composition root satisfies the port, both catalogs carry its copy,
 * and both interfaces link to it. A generator that emitted files without these
 * would hand its user a folder of dead code.
 */
export const featureRegistryEdits: readonly RegistryEdit[] = [
  {
    apply: (content, names) =>
      addSortedReexport(
        "packages/domain/src/index.ts",
        content,
        `./${names.kebab}`,
        domainExports(names),
      ),
    file: "packages/domain/src/index.ts",
    revert: (content, names) => removeReexport(content, `./${names.kebab}`),
  },
  {
    apply: (content, names, shape) => {
      const withTypes = insertBeforeLine(
        "packages/api/src/context.ts",
        content,
        "export type TRPCContext = {",
        `export type ${names.pascal}Repository`,
        `${portDeclaration(names, shape)}\n`,
      );
      return addObjectEntry(
        "packages/api/src/context.ts",
        withTypes,
        "export type TRPCContext = {",
        `${names.camelPlural}: ${names.pascal}Repository;`,
      );
    },
    file: "packages/api/src/context.ts",
    revert: (content, names) =>
      removeObjectEntry(
        removeDeclaration(
          removeDeclaration(content, `export type ${names.pascal}Repository`),
          `export type ${names.pascal}Record`,
        ),
        "export type TRPCContext = {",
        names.camelPlural,
      ),
  },
  {
    apply: (content, names) =>
      mergeBraceList(
        "packages/api/src/index.ts",
        content,
        /export type \{([^{}]*)\} from "\.\/context";/,
        [`${names.pascal}Record`, `${names.pascal}Repository`],
      ),
    file: "packages/api/src/index.ts",
    revert: (content, names) =>
      removeBraceListNames(
        content,
        /export type \{([^{}]*)\} from "\.\/context";/,
        [`${names.pascal}Record`, `${names.pascal}Repository`],
      ),
  },
  {
    apply: (content, names) => {
      const imported = insertBeforeLine(
        "packages/api/src/root.ts",
        content,
        "import { createCallerFactory",
        `from "./routers/${names.kebab}"`,
        `import { ${names.camel}Router } from "./routers/${names.kebab}";`,
      );
      return addObjectEntry(
        "packages/api/src/root.ts",
        imported,
        "export const appRouter = createTRPCRouter({",
        `${names.camel}: ${names.camel}Router,`,
      );
    },
    file: "packages/api/src/root.ts",
    revert: (content, names) =>
      removeObjectEntry(
        removeLinesContaining(content, `from "./routers/${names.kebab}"`),
        "export const appRouter = createTRPCRouter({",
        names.camel,
      ),
  },
  {
    apply: (content, names) =>
      addObjectEntry(
        "packages/api/src/test-support/context.ts",
        content,
        "const inertPorts = {",
        inertPortEntry(names),
      ),
    file: "packages/api/src/test-support/context.ts",
    revert: (content, names) =>
      removeObjectEntry(content, "const inertPorts = {", names.camelPlural),
  },
  {
    apply: (content, names) =>
      addSortedReexport(
        "packages/db/src/index.ts",
        content,
        `./${names.kebab}-repository`,
        `export { createPrisma${names.pascal}Repository } from "./${names.kebab}-repository";`,
      ),
    file: "packages/db/src/index.ts",
    revert: (content, names) =>
      removeReexport(content, `./${names.kebab}-repository`),
  },
  {
    apply: (content, names, shape) => {
      const withModel = addPrismaModel(
        "packages/db/prisma/schema.prisma",
        content,
        names.pascal,
        prismaModel(names, shape),
      );
      const withUser = addPrismaField(
        "packages/db/prisma/schema.prisma",
        withModel,
        "User",
        `${names.camelPlural} ${names.pascal}[]`,
      );
      return addPrismaField(
        "packages/db/prisma/schema.prisma",
        withUser,
        "Organization",
        `${names.camelPlural} ${names.pascal}[]`,
      );
    },
    file: "packages/db/prisma/schema.prisma",
    revert: (content, names) =>
      removePrismaField(
        removePrismaField(
          removePrismaModel(content, names.pascal),
          "User",
          names.camelPlural,
        ),
        "Organization",
        names.camelPlural,
      ),
  },
  {
    apply: (content, names) => {
      const file = "apps/web/src/server/api/context.ts";
      const withTypes = mergeBraceList(
        file,
        content,
        /import type \{([^{}]*)\} from "@ai-starter\/api";/,
        [`${names.pascal}Repository`],
      );
      const withAdapter = mergeBraceList(
        file,
        withTypes,
        /import \{([^{}]*)\} from "@ai-starter\/db";/,
        [`createPrisma${names.pascal}Repository`],
      );
      const wired = insertBeforeLine(
        file,
        withAdapter,
        "export const createTRPCContext",
        `createPrisma${names.pascal}Repository(`,
        compositionRootWiring(names),
      );
      return addObjectEntry(
        file,
        wired,
        "return createSharedTRPCContext({",
        `${names.camelPlural},`,
      );
    },
    file: "apps/web/src/server/api/context.ts",
    revert: (content, names) => {
      const unwired = removeObjectEntry(
        removeDeclaration(
          content,
          `const ${names.camelPlural}: ${names.pascal}Repository`,
        ),
        "return createSharedTRPCContext({",
        names.camelPlural,
      );
      return removeBraceListNames(
        removeBraceListNames(
          unwired,
          /import type \{([^{}]*)\} from "@ai-starter\/api";/,
          [`${names.pascal}Repository`],
        ),
        /import \{([^{}]*)\} from "@ai-starter\/db";/,
        [`createPrisma${names.pascal}Repository`],
      );
    },
  },
  {
    apply: (content, names) =>
      insertAfterLine(
        "apps/web/src/lib/routes.ts",
        content,
        "export const dashboardPath",
        `${names.camelPlural}Path`,
        `export const ${names.camelPlural}Path = "/${names.kebabPlural}";`,
      ),
    file: "apps/web/src/lib/routes.ts",
    revert: (content, names) =>
      removeLinesContaining(content, `export const ${names.camelPlural}Path =`),
  },
  {
    apply: (content, names) => {
      const file = "apps/web/src/components/app-shell/app-shell.tsx";
      const imported = mergeBraceList(
        file,
        content,
        /import \{([^{}]*)\} from "~\/lib\/routes";/,
        [`${names.camelPlural}Path`],
      );
      return insertAfterLine(
        file,
        imported,
        navigationAnchor,
        `href: ${names.camelPlural}Path`,
        `            { href: ${names.camelPlural}Path, label: tNav("${names.camelPlural}") },`,
      );
    },
    file: "apps/web/src/components/app-shell/app-shell.tsx",
    revert: (content, names) =>
      removeBraceListNames(
        removeObjectLiteralContaining(
          content,
          `href: ${names.camelPlural}Path`,
        ),
        /import \{([^{}]*)\} from "~\/lib\/routes";/,
        [`${names.camelPlural}Path`],
      ),
  },
  {
    apply: (content, names) =>
      insertAfterLine(
        "apps/mobile/src/app/(app)/_layout.tsx",
        content,
        tabAnchor,
        `name="${names.kebabPlural}"`,
        `      <Tabs.Screen name="${names.kebabPlural}" options={{ title: t("${names.camelPlural}") }} />`,
      ),
    file: "apps/mobile/src/app/(app)/_layout.tsx",
    revert: (content, names) =>
      removeJsxElementContaining(content, `name="${names.kebabPlural}"`),
  },
  {
    apply: addFeatureNamespace,
    file: "packages/i18n/messages/en.json",
    revert: removeFeatureNamespace,
  },
  {
    apply: addFeatureNamespace,
    file: "packages/i18n/messages/nl.json",
    revert: removeFeatureNamespace,
  },
];

/**
 * Every multi-line block a feature leaves in a file it does not own.
 *
 * `golden-path.test.ts` pins the files the generator *creates*; this is the
 * other half. A registration cannot be pinned by re-running the edit and
 * checking that nothing moved — every helper is guarded by a marker that asks
 * whether the registration is *present*, so a reworded block is idempotent and
 * drifted at the same time. Comparing the text is what tells them apart.
 *
 * The single-line registrations are left out on purpose: a route constant or a
 * router key has nowhere to drift to, and `feature-generator.test.ts` already
 * asserts each one verbatim.
 */
function registrationRegions(
  names: FeatureNames,
  shape: FeatureShape,
): readonly { readonly file: string; readonly text: string }[] {
  return [
    { file: "packages/domain/src/index.ts", text: domainExports(names) },
    {
      file: "packages/api/src/context.ts",
      text: portDeclaration(names, shape),
    },
    {
      file: "packages/api/src/test-support/context.ts",
      text: inertPortEntry(names),
    },
    {
      file: "packages/db/prisma/schema.prisma",
      text: prismaModel(names, shape),
    },
    {
      file: "apps/web/src/server/api/context.ts",
      text: compositionRootWiring(names).trimEnd(),
    },
  ];
}

/**
 * Leading whitespace, dropped from both sides of a region comparison.
 *
 * A block is written at the indent of whatever object it lands in and then
 * reflowed by Prettier, so the generator's own text is never indented the way
 * the file ends up — and indentation is the one kind of drift `format:check`
 * already owns. Every other character has to match.
 */
function withoutIndent(text: string): string {
  return text
    .split("\n")
    .map((line) => line.trimStart())
    .join("\n");
}

/**
 * The files in `root` whose registration region no longer says what the
 * generator would say. An empty list is the only healthy answer.
 */
export function driftedRegions(
  root: string,
  names: FeatureNames,
  shape: FeatureShape,
): readonly string[] {
  return registrationRegions(names, shape)
    .filter(
      ({ file, text }) =>
        !withoutIndent(readFileSync(path.join(root, file), "utf8")).includes(
          withoutIndent(text),
        ),
    )
    .map(({ file }) => file);
}

/**
 * An adapter registers only its port: the concrete client is constructed at the
 * composition root by whichever use case needs it, and inventing that call site
 * before a use case exists would be the speculative wiring the contract forbids.
 */
export const adapterRegistryEdits: readonly RegistryEdit[] = [
  {
    apply: (content, names) =>
      addSortedReexport(
        "packages/api/src/index.ts",
        content,
        `./${names.kebab}`,
        [
          "export {",
          `  ${names.pascal}Failure,`,
          `  type ${names.pascal}Client,`,
          `  type ${names.pascal}FailureReason,`,
          `  type ${names.pascal}Reference,`,
          `} from "./${names.kebab}";`,
        ].join("\n"),
      ),
    file: "packages/api/src/index.ts",
    revert: (content, names) => removeReexport(content, `./${names.kebab}`),
  },
];

function adapterFollowUps(names: FeatureNames): string[] {
  return [
    `Construct create${names.pascal}Client in apps/web's composition root where a use case needs it, reading its key and base URL from env.js.`,
    `Add that key to .env.example, to the diagnose checks, and to turbo.json's build env.`,
    `Replace the placeholder reference call in apps/web/src/server/${names.kebab}/client.ts with the provider's real endpoint and response shape.`,
  ];
}

export type RemovalResult = {
  /** Files the slice owned, now gone. */
  readonly removed: readonly string[];
  /** Files a registration was taken out of. */
  readonly edited: readonly string[];
  /** Registries that never mentioned it. */
  readonly unchanged: readonly string[];
  /** Paths the slice should have owned and did not. */
  readonly absent: readonly string[];
  readonly followUps: readonly string[];
};

export type GenerationResult = {
  readonly created: readonly string[];
  readonly skipped: readonly string[];
  readonly edited: readonly string[];
  readonly unchanged: readonly string[];
  readonly followUps: readonly string[];
};

/**
 * The two things a generator cannot do for you, named with their commands.
 *
 * There were three until the shape became an argument. The third asked the
 * reader to decide, after the fact, whether the slice they had just been handed
 * was shaped like their product — a question the command is now unable to avoid
 * asking first, and one nobody has to answer twice.
 */
function featureFollowUps(names: FeatureNames, shape: FeatureShape): string[] {
  const sql = featureMigrationSql(names, shape);

  return [
    `Create the migration: pnpm db:migrate:dev --name add_${names.camelPlural} --create-only`,
    `Put this above what Prisma wrote in that migration.sql:\n\n${indent(sql.header.trimEnd())}`,
    `And this below it — \`pnpm db:lint\` rejects the file without both:\n${indent(sql.body.trimEnd())}`,
    `Apply it: pnpm db:migrate:dev`,
    `Translate the ${names.titlePlural} copy in packages/i18n/messages/nl.json; it was written in English, and \`pnpm policy\` fails on every value that still matches en.json.`,
  ];
}

/** Keeps a pasteable block readable under the command's own bullet indent. */
function indent(block: string): string {
  return block
    .split("\n")
    .map((line) => (line.length === 0 ? line : `      ${line}`))
    .join("\n");
}

function writeRendered(
  root: string,
  rendered: Map<string, string>,
  created: string[],
  skipped: string[],
): void {
  for (const [relative, contents] of rendered) {
    const absolute = path.join(root, relative);
    if (existsSync(absolute)) {
      skipped.push(relative);
      continue;
    }
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, contents);
    created.push(relative);
  }
}

function applyEdits(
  root: string,
  names: FeatureNames,
  shape: FeatureShape,
  edits: readonly RegistryEdit[],
  edited: string[],
  unchanged: string[],
): void {
  for (const edit of edits) {
    const absolute = path.join(root, edit.file);
    if (!existsSync(absolute)) {
      throw new Error(
        `${edit.file} is missing, so the feature cannot register itself there.`,
      );
    }
    const before = readFileSync(absolute, "utf8");
    const after = edit.apply(before, names, shape);
    if (after === before) {
      unchanged.push(edit.file);
      continue;
    }
    writeFileSync(absolute, after);
    edited.push(edit.file);
  }
}

/** Writes the bounded context on its own: the domain half of a feature. */
export function generateContext(
  root: string,
  names: FeatureNames,
): GenerationResult {
  const created: string[] = [];
  const skipped: string[] = [];
  const edited: string[] = [];
  const unchanged: string[] = [];

  writeRendered(root, renderTree("context", names), created, skipped);
  // The bounded context is the same in every shape — same schemas, same codes,
  // same invariants — so this command asks no shape question, and the registry
  // it touches is the one that does not vary either.
  applyEdits(
    root,
    names,
    "current",
    featureRegistryEdits.slice(0, 1),
    edited,
    unchanged,
  );

  return { created, edited, followUps: [], skipped, unchanged };
}

/** The port and its adapter for one external service, with no vendor chosen. */
export function generateAdapter(
  root: string,
  names: FeatureNames,
): GenerationResult {
  const created: string[] = [];
  const skipped: string[] = [];
  const edited: string[] = [];
  const unchanged: string[] = [];

  writeRendered(root, renderTree("adapter", names), created, skipped);
  applyEdits(root, names, "current", adapterRegistryEdits, edited, unchanged);

  return {
    created,
    edited,
    followUps: adapterFollowUps(names),
    skipped,
    unchanged,
  };
}

/**
 * The feature templates for one shape: the base tree with the shape's overlay
 * written over it.
 *
 * The overlay carries only the files a shape genuinely changes — the repository
 * and its integration test, the router and its test, both panels and their
 * tests, and the browser journey. The boards, the screens, the field-error
 * helpers and the rename forms are one file serving both, which is the point: a
 * shape is a difference in what the records mean to each other, not a second
 * slice. Later entries win, so an overlay file replaces the base file at the
 * same path.
 */
export function featureTree(
  names: FeatureNames,
  shape: FeatureShape,
): Map<string, string> {
  const overlay = shapeOverlay(shape);
  const base = renderTree("feature", names);

  return overlay === undefined
    ? base
    : new Map([...base, ...renderTree(overlay, names)]);
}

/**
 * The pin, taken off the slice being removed.
 *
 * Not one of the registry edits: generation never adds an entry here, because a
 * product edits the feature it generated and pinning it would fail the first
 * time it did. Only removal touches it, and only to take an entry away — which
 * is what lets `pnpm generate feature --remove announcement` leave a green suite
 * behind instead of a drift test with nothing left to compare.
 */
const examplePin: RegistryEdit = {
  apply: (content) => content,
  file: "packages/tooling/src/generators/example-slices.ts",
  revert: (content, names) =>
    removeLinesContaining(content, `{ name: "${names.kebab}",`),
};

/**
 * A file's contents, or `undefined` when there is no such file.
 *
 * Only "no such file" answers `undefined`; an unreadable file still throws, so a
 * permission problem is reported rather than recorded as a registration that was
 * never there.
 */
function readIfPresent(absolute: string): string | undefined {
  try {
    return readFileSync(absolute, "utf8");
  } catch (thrown) {
    if (
      thrown instanceof Error &&
      "code" in thrown &&
      thrown.code === "ENOENT"
    ) {
      return undefined;
    }
    throw thrown;
  }
}

/** Every shared file `--remove` touches: the registries, and the pin. */
export const featureRemovalEdits: readonly RegistryEdit[] = [
  ...featureRegistryEdits,
  examplePin,
];

/**
 * Deletes a generated slice and reverses every registration it made.
 *
 * The paths are the same in both shapes — an overlay replaces a file, it does
 * not add one — so removal takes no shape, and neither does anything it reverses.
 *
 * What it deliberately cannot do is drop the table: the migration that created
 * it has been applied, and an applied migration is immutable. That is reported
 * rather than attempted.
 */
export function removeFeature(
  root: string,
  names: FeatureNames,
): RemovalResult {
  const removed: string[] = [];
  const absent: string[] = [];
  const edited: string[] = [];
  const unchanged: string[] = [];

  const paths = [
    ...renderTree("context", names).keys(),
    ...featureTree(names, "current").keys(),
  ];

  for (const relative of paths) {
    const absolute = path.join(root, relative);
    if (!existsSync(absolute)) {
      absent.push(relative);
      continue;
    }
    rmSync(absolute);
    removed.push(relative);
  }

  for (const directory of emptiedDirectories(root, paths)) {
    rmSync(path.join(root, directory), { recursive: true });
  }

  /*
   * Next keeps generated route types under `.next`, and they outlive the route.
   * Leaving them turns the very next `pnpm typecheck` into
   * `Cannot find module '…/src/app/(app)/release-notes/page.js'` — a message
   * that names a file nobody wrote, about a directory nobody mentions, after a
   * command that reported success. Stage 13 hit it twice and recorded it as
   * unexplained; it is explained, and this is where it stops.
   */
  if (removed.some((relative) => relative.startsWith("apps/web/src/app/"))) {
    const cache = path.join(root, "apps/web/.next");
    if (existsSync(cache)) {
      rmSync(cache, { recursive: true });
      removed.push("apps/web/.next (stale route types)");
    }
  }

  for (const edit of featureRemovalEdits) {
    const absolute = path.join(root, edit.file);
    // The read is the check. Asking `existsSync` first and writing afterwards
    // is `js/file-system-race`, and nothing the question answers makes the
    // later write safe — stage 17 met the same shape in `handOverReadme`.
    const before = readIfPresent(absolute);
    if (before === undefined) {
      absent.push(edit.file);
      continue;
    }
    const after = edit.revert(before, names);
    if (after === before) {
      unchanged.push(edit.file);
      continue;
    }
    writeFileSync(absolute, after);
    edited.push(edit.file);
  }

  return {
    absent,
    edited,
    followUps: [
      `Drop the table: pnpm db:migrate:dev --name drop_${names.camelPlural} --create-only, then write \`DROP TABLE "${names.pascal}";\` under the two \`set\` timeouts and apply it. The migration that created it has been applied, so it cannot be edited or deleted.`,
      `Remove any ${names.lowerPlural} copy a translator has since added to packages/i18n/messages/nl.json beyond the generated namespace.`,
      // Said here because the asymmetry is deliberate and would otherwise look
      // like a bug: generating never pins, so regenerating cannot un-remove.
      `Generating ${names.lowerPlural} again writes the slice back, but not its entry in packages/tooling/src/generators/example-slices.ts. That pin is this repository's promise that a slice is untouched generator output, and a slice you are about to edit is not one anybody can promise that about.`,
      // Only when this was the last one, and it is left as a report rather than
      // fixed: `packages/api` genuinely has no use for the domain package when
      // no slice validates anything, and the tRPC client genuinely has no
      // consumer when nothing calls a procedure. Both come back with the next
      // `pnpm generate feature`, and removing them would break it.
      "If this was the last feature slice, `pnpm knip` will report three things with no consumer left: `@ai-starter/domain` in packages/api, and the `api` client and `RouterOutputs` type in each app's trpc module. All three are true and all three end the moment you generate a feature. Generate yours before running the full suite.",
    ],
    removed,
    unchanged,
  };
}

/** Directories a removal has emptied, deepest first so a parent empties too. */
function emptiedDirectories(
  root: string,
  paths: readonly string[],
): readonly string[] {
  const candidates = new Set(paths.map((relative) => path.dirname(relative)));

  return [...candidates]
    .sort((left, right) => right.length - left.length)
    .filter((directory) => {
      const absolute = path.join(root, directory);
      return existsSync(absolute) && readdirSync(absolute).length === 0;
    });
}

/** Writes the whole vertical slice and registers it everywhere it belongs. */
export function generateFeature(
  root: string,
  names: FeatureNames,
  shape: FeatureShape,
): GenerationResult {
  const created: string[] = [];
  const skipped: string[] = [];
  const edited: string[] = [];
  const unchanged: string[] = [];

  writeRendered(root, renderTree("context", names), created, skipped);
  writeRendered(root, featureTree(names, shape), created, skipped);
  applyEdits(root, names, shape, featureRegistryEdits, edited, unchanged);

  return {
    created,
    edited,
    followUps: featureFollowUps(names, shape),
    skipped,
    unchanged,
  };
}
