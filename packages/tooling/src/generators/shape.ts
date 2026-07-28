import { type FeatureNames } from "./naming.ts";

/**
 * How a generated feature's records relate to each other.
 *
 * Structure is all a generator can carry across domains, and until this existed
 * it carried meaning too: every slice arrived modelling one current record per
 * group with earlier ones superseded, and every catalog said so. A cold agent
 * given "households organise chores" replaced the model — correctly — and kept
 * the copy, shipping a chore board that talks about publishing. Nothing failed,
 * because nothing could: both catalogs were in parity and every key was typed.
 *
 * So the shape is named at the command instead of assumed. There is no default:
 * the supersession copy can now only reach a product whose author typed the name
 * of the shape that supersedes.
 */
export const featureShapes = ["current", "list"] as const;

export type FeatureShape = (typeof featureShapes)[number];

export function isFeatureShape(value: string): value is FeatureShape {
  return featureShapes.includes(value as FeatureShape);
}

/** One line per shape, for the command's usage and its error. */
export const shapeSummaries: Readonly<Record<FeatureShape, string>> = {
  current:
    "one record per group is current and creating supersedes it. Announcements, status pages, published policies.",
  list: "records accumulate and each stands on its own. Chores, notes, posts.",
};

/** The template tree overlaid on `feature`, or undefined when it is the base. */
export function shapeOverlay(shape: FeatureShape): string | undefined {
  return shape === "list" ? "feature-list" : undefined;
}

/**
 * The port a shape declares: the record the interface reads, and the reads and
 * writes the layer needs.
 *
 * `create` and `rename` are named for what they do to the data, not for what the
 * shape calls it — the shape's own word ("Publish", "Add") is copy, and copy
 * lives in the catalog. That is what keeps the domain half of a slice shapeless:
 * `pnpm generate context` asks no shape question because its answer would not
 * change a single character of what it writes.
 */
export function portDeclaration(
  names: FeatureNames,
  shape: FeatureShape,
): string {
  const record =
    shape === "current"
      ? `/** One ${names.lower}, as the group it belongs to may read it. */
export type ${names.pascal}Record = Readonly<{
  id: string;
  title: string;
  /** Whether this is the ${names.lower} the group is currently showing. */
  isCurrent: boolean;
}>;`
      : `/** One ${names.lower}, as the group it belongs to may read it. */
export type ${names.pascal}Record = Readonly<{
  id: string;
  title: string;
}>;`;

  const createDoc =
    shape === "current"
      ? `\`create\` supersedes the group's current ${names.lower}; \`listByGroup\`
 * answers newest first, so the current one leads.`
      : `\`create\` appends: nothing it writes changes a ${names.lower} that is
 * already there, and \`listByGroup\` answers newest first.`;

  return `${record}

/**
 * The ${names.lower} reads and writes this layer needs, shaped by the use cases
 * rather than by the table behind them.
 *
 * ${createDoc}
 *
 * Every operation is keyed by a group. There is no "read one" call that skips a
 * group, so a procedure cannot reach outside the group the request was made in —
 * \`rename\` answers \`null\` for an identifier that belongs to a different group,
 * which is the same shape \`findMembership\` uses to refuse.
 */
export type ${names.pascal}Repository = Readonly<{
  listByGroup: (groupId: string) => Promise<${names.pascal}Record[]>;
  create: (input: {
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

/** The length the title CHECK constraint allows, mirroring the domain policy. */
const titleMaxLength = 120;

/**
 * The CHECK every shape needs: the domain schema's `.trim().min(1)` protects the
 * forms, not the table, and this is the whole length bound. The column is `text`
 * because a `varchar(n)` can only be widened under a lock that stops every read
 * and write.
 */
function titleCheckSql(names: FeatureNames): string {
  return `-- Prisma has no CHECK syntax, and the domain schema's \`.trim().min(1)\`
-- protects the forms, not the table. This is the whole length bound: the column
-- is \`text\`, because a \`varchar(n)\` can only be widened under a lock that stops
-- every read and write.
ALTER TABLE "${names.pascal}" ADD CONSTRAINT "${names.pascal}_title_length_check" CHECK (char_length(btrim("title")) BETWEEN 1 AND ${String(titleMaxLength)});
`;
}

/**
 * The SQL a generated migration needs and Prisma cannot write.
 *
 * `header` goes above everything Prisma emitted; `body` below it. Both halves
 * are here rather than in the follow-up text because the fresh-template
 * rehearsal applies exactly what a reader is told to paste — a second copy would
 * drift, and the one that drifts is always the one nobody runs.
 */
export function featureMigrationSql(
  names: FeatureNames,
  shape: FeatureShape,
): {
  header: string;
  body: string;
} {
  const currentIndex = `
-- Prisma cannot express a partial index, and "at most one current ${names.lower}
-- per group" is an invariant the application checks inside a transaction but
-- cannot enforce against a second concurrent writer.
CREATE UNIQUE INDEX "${names.pascal}_groupId_current_key" ON "${names.pascal}"("groupId") WHERE "isCurrent";
`;

  return {
    body: `${shape === "current" ? currentIndex : ""}
${titleCheckSql(names)}`,
    header: `-- Prisma applies each migration inside a transaction, so both timeouts are
-- transaction-local. Without them a schema change waits behind whatever is
-- already holding the table, for as long as that takes.
set lock_timeout = '1s';
set statement_timeout = '5s';

`,
  };
}

export function prismaModel(names: FeatureNames, shape: FeatureShape): string {
  const currentDoc = `/// A group-owned record: the shape a generated feature slice follows.
///
/// The group is the owner, so every query the adapter runs is keyed by it. At
/// most one ${names.lower} per group may be current, which PostgreSQL enforces
/// with a partial unique index the migration adds by hand — Prisma cannot
/// express a \`WHERE\` clause on an index, and an invariant only the application
/// checks is one a second writer can break. The title's length is a CHECK
/// constraint in the same migration rather than a \`varchar(n)\`, which can only
/// be widened under a lock that stops every read and write.`;

  const listDoc = `/// A group-owned record: the shape a generated feature slice follows.
///
/// The group is the owner, so every query the adapter runs is keyed by it.
/// Records accumulate and none of them is special, so there is no flag to keep
/// consistent and nothing a second concurrent writer can break. The title's
/// length is a CHECK constraint in the migration rather than a \`varchar(n)\`,
/// which can only be widened under a lock that stops every read and write.`;

  const currentField = `  isCurrent Boolean  @default(false)\n`;

  return `${shape === "current" ? currentDoc : listDoc}
model ${names.pascal} {
  id        String   @id @default(cuid())
  title     String
${shape === "current" ? currentField : ""}  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  group   Organization @relation(fields: [groupId], references: [id], onDelete: Cascade)
  groupId String

  createdBy   User   @relation(fields: [createdById], references: [id], onDelete: Cascade)
  createdById String

  @@index([groupId, createdAt])
}`;
}

/**
 * The catalog namespace a generated feature ships, in the language the templates
 * assert against.
 *
 * The keys are the same in both shapes and the words are not: `create.submit` is
 * "Publish" where creating supersedes and "Add" where it does not. That split is
 * the whole mechanism — a panel reads a key, so the markup stays shapeless while
 * the sentence a reader sees belongs to the shape they asked for.
 *
 * Copy is written so it survives having a product's own noun substituted into
 * it: no indefinite articles, because "an release note" is how a generator gives
 * itself away, and the two title fields are labelled apart because a screen with
 * two fields both called "Title" is ambiguous to a reader and to a test.
 */
export function catalogNamespace(
  names: FeatureNames,
  shape: FeatureShape,
): Record<string, unknown> {
  const sections =
    shape === "current"
      ? {
          create: {
            title: `New ${names.lower}`,
            description: `Publishing supersedes the current ${names.lower}.`,
            label: "New title",
            submit: "Publish",
            submitting: "Publishing…",
          },
          rename: {
            label: "Current title",
            submit: "Save",
            submitting: "Saving…",
            saved: "Saved.",
          },
          current: {
            title: `Current ${names.lower}`,
            empty: "This group has not published anything yet.",
          },
          earlier: {
            title: `Earlier ${names.lowerPlural}`,
            empty: "Nothing has been superseded yet.",
          },
        }
      : {
          create: {
            title: `New ${names.lower}`,
            description: `Every ${names.lower} you add stays in the list.`,
            label: "New title",
            submit: "Add",
            submitting: "Adding…",
          },
          rename: {
            label: "Title",
            submit: "Save",
            submitting: "Saving…",
            saved: "Saved.",
          },
          list: {
            title: `All ${names.lowerPlural}`,
            empty: "This group has not added anything yet.",
          },
        };

  return {
    title: names.titlePlural,
    description: `${names.titlePlural} belong to the group you are working in. Switch groups and you are looking at another set.`,
    loading: `Loading ${names.lowerPlural}…`,
    count: `{count, plural, =0 {No ${names.lowerPlural} yet} one {# ${names.lower}} other {# ${names.lowerPlural}}}`,
    ...sections,
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
