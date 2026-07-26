import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { addFeatureNamespace } from "./catalog-edits.ts";
import { type FeatureNames } from "./naming.ts";
import { addPrismaField, addPrismaModel } from "./prisma-edits.ts";
import { renderTree } from "./render.ts";
import {
  addObjectEntry,
  addSortedReexport,
  insertAfterLine,
  insertBeforeLine,
  mergeBraceList,
} from "./source-edits.ts";

export type RegistryEdit = {
  /** Repository-relative file the feature has to register itself in. */
  readonly file: string;
  readonly apply: (content: string, names: FeatureNames) => string;
};

const navigationAnchor = "A generated feature registers its section";
const tabAnchor = "A generated feature registers its tab";

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
        [
          "export {",
          `  ${names.camel}TitlePolicy,`,
          `  ${names.camel}ValidationCodes,`,
          `  parse${names.pascal}ValidationCode,`,
          `  publish${names.pascal}InputSchema,`,
          `  rename${names.pascal}InputSchema,`,
          `  type ${names.pascal}ValidationCode,`,
          `  type Publish${names.pascal}Input,`,
          `  type Rename${names.pascal}Input,`,
          `} from "./${names.kebab}";`,
        ].join("\n"),
      ),
    file: "packages/domain/src/index.ts",
  },
  {
    apply: (content, names) => {
      const withTypes = insertBeforeLine(
        "packages/api/src/context.ts",
        content,
        "export type TRPCContext = {",
        `export type ${names.pascal}Repository`,
        `${portDeclaration(names)}\n`,
      );
      return addObjectEntry(
        "packages/api/src/context.ts",
        withTypes,
        "export type TRPCContext = {",
        `${names.camelPlural}: ${names.pascal}Repository;`,
      );
    },
    file: "packages/api/src/context.ts",
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
  },
  {
    apply: (content, names) =>
      addObjectEntry(
        "packages/api/src/test-support/context.ts",
        content,
        "const inertPorts = {",
        [
          `${names.camelPlural}: {`,
          `  listByGroup: absent("${names.camelPlural}", "listByGroup"),`,
          `  publish: absent("${names.camelPlural}", "publish"),`,
          `  rename: absent("${names.camelPlural}", "rename"),`,
          "},",
        ].join("\n"),
      ),
    file: "packages/api/src/test-support/context.ts",
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
  },
  {
    apply: (content, names) => {
      const withModel = addPrismaModel(
        "packages/db/prisma/schema.prisma",
        content,
        names.pascal,
        prismaModel(names),
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
        [
          "// The port is declared by the API layer and satisfied here, at the one",
          "// place that may know both halves. Nothing above this file names Prisma.",
          `const ${names.camelPlural}: ${names.pascal}Repository =`,
          `  createPrisma${names.pascal}Repository(db);`,
          "",
        ].join("\n"),
      );
      return addObjectEntry(
        file,
        wired,
        "return createSharedTRPCContext({",
        `${names.camelPlural},`,
      );
    },
    file: "apps/web/src/server/api/context.ts",
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
  },
  {
    apply: addFeatureNamespace,
    file: "packages/i18n/messages/en.json",
  },
  {
    apply: addFeatureNamespace,
    file: "packages/i18n/messages/nl.json",
  },
];

function portDeclaration(names: FeatureNames): string {
  return `/** One ${names.lower}, as the group it belongs to may read it. */
export type ${names.pascal}Record = Readonly<{
  id: string;
  title: string;
  /** Whether this is the ${names.lower} the group is currently showing. */
  isCurrent: boolean;
}>;

/**
 * The ${names.lower} reads and writes this layer needs, shaped by the use cases
 * rather than by the table behind them.
 *
 * Every operation is keyed by a group. There is no "read one" call that skips a
 * group, so a procedure cannot reach outside the group the request was made in —
 * \`rename\` answers \`null\` for an identifier that belongs to a different group,
 * which is the same shape \`findMembership\` uses to refuse.
 */
export type ${names.pascal}Repository = Readonly<{
  listByGroup: (groupId: string) => Promise<${names.pascal}Record[]>;
  publish: (input: {
    createdById: string;
    groupId: string;
    title: string;
  }) => Promise<${names.pascal}Record>;
  rename: (input: {
    ${names.camel}Id: string;
    groupId: string;
    title: string;
  }) => Promise<${names.pascal}Record | null>;
}>;`;
}

function prismaModel(names: FeatureNames): string {
  return `/// A group-owned record: the shape a generated feature slice follows.
///
/// The group is the owner, so every query the adapter runs is keyed by it. At
/// most one ${names.lower} per group may be current, which PostgreSQL enforces
/// with a partial unique index the migration adds by hand — Prisma cannot
/// express a \`WHERE\` clause on an index, and an invariant only the application
/// checks is one a second writer can break.
model ${names.pascal} {
  id        String   @id @default(cuid())
  title     String   @db.VarChar(120)
  isCurrent Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  group   Organization @relation(fields: [groupId], references: [id], onDelete: Cascade)
  groupId String

  createdBy   User   @relation(fields: [createdById], references: [id], onDelete: Cascade)
  createdById String

  @@index([groupId, createdAt])
}`;
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
  },
];

export function adapterFollowUps(names: FeatureNames): string[] {
  return [
    `Construct create${names.pascal}Client in apps/web's composition root where a use case needs it, reading its key and base URL from env.js.`,
    `Add that key to .env.example, to the diagnose checks, and to turbo.json's build env.`,
    `Replace the placeholder reference call in apps/web/src/server/${names.kebab}/client.ts with the provider's real endpoint and response shape.`,
  ];
}

export type GenerationResult = {
  readonly created: readonly string[];
  readonly skipped: readonly string[];
  readonly edited: readonly string[];
  readonly unchanged: readonly string[];
  readonly followUps: readonly string[];
};

/** The two things a generator cannot do for you, named with their commands. */
export function featureFollowUps(names: FeatureNames): string[] {
  return [
    `Create the migration: pnpm db:migrate:dev --name add_${names.camelPlural} --create-only`,
    `Add the partial unique index and the title CHECK to that migration.sql (Prisma cannot express either), then apply it: pnpm db:migrate:dev`,
    `Translate the ${names.titlePlural} copy in packages/i18n/messages/nl.json; it was written in English.`,
  ];
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
    const after = edit.apply(before, names);
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
  applyEdits(root, names, featureRegistryEdits.slice(0, 1), edited, unchanged);

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
  applyEdits(root, names, adapterRegistryEdits, edited, unchanged);

  return {
    created,
    edited,
    followUps: adapterFollowUps(names),
    skipped,
    unchanged,
  };
}

/** Writes the whole vertical slice and registers it everywhere it belongs. */
export function generateFeature(
  root: string,
  names: FeatureNames,
): GenerationResult {
  const created: string[] = [];
  const skipped: string[] = [];
  const edited: string[] = [];
  const unchanged: string[] = [];

  writeRendered(root, renderTree("context", names), created, skipped);
  writeRendered(root, renderTree("feature", names), created, skipped);
  applyEdits(root, names, featureRegistryEdits, edited, unchanged);

  return {
    created,
    edited,
    followUps: featureFollowUps(names),
    skipped,
    unchanged,
  };
}
