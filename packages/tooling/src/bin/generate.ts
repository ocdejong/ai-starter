import { runCapture } from "../command.ts";
import {
  generateAdapter,
  generateContext,
  generateFeature,
  type GenerationResult,
  removeFeature,
  type RemovalResult,
} from "../generators/feature.ts";
import { featureNames } from "../generators/naming.ts";
import {
  featureShapes,
  isFeatureShape,
  shapeSummaries,
} from "../generators/shape.ts";
import { repositoryRoot } from "../repository.ts";

const shapeHelp = featureShapes
  .map((shape) => `  --shape ${shape.padEnd(8)}${shapeSummaries[shape]}`)
  .join("\n");

const usage = `Usage: pnpm generate <context|feature|adapter> <name> [plural] [--shape <${featureShapes.join("|")}>]

Writes a slice of the shape this repository already uses, in the product's own
words, and registers it everywhere it has to be registered.

  context   A bounded context in packages/domain: schemas, invariants and the
            stable validation codes an interface translates.
  feature   The whole vertical slice — the context, a consumer-owned port, a
            Prisma adapter, a group-scoped tRPC router, web and native screens,
            and tests at every layer.
  adapter   A port for an external service and a vendor-free adapter behind it,
            with a timeout, a parsed response, translated errors and redaction.

<name> is a lower-case, kebab-case, singular noun: "invoice", "release-note".
Give [plural] only when English needs help: \`pnpm generate feature person people\`.

\`feature\` requires --shape, because how records relate to each other is a
decision about the product and there is no answer that is right by default:

${shapeHelp}

\`context\` and \`adapter\` take no shape: what they write is identical either way.

\`pnpm generate feature --remove <name>\` is the inverse: it deletes the slice's
own files and takes every registration back out. It needs no shape — what has to
go is identified by name — and it names the one thing it cannot do, dropping the
table, because the migration that created it has been applied.

Two things it cannot do for you, and says so when it finishes: creating the
migration (Prisma cannot express a partial index or a CHECK, so that SQL is
written by hand) and translating the Dutch catalog entries, which \`pnpm policy\`
reports as untranslated until somebody writes them.`;

const argv = process.argv.slice(2);
const shapeAt = argv.indexOf("--shape");
// -1 rather than `shapeAt + 1`, which would be 0 when there is no `--shape` and
// would silently swallow the kind.
const shapeValueAt = shapeAt === -1 ? -1 : shapeAt + 1;
const shapeValue = shapeAt === -1 ? undefined : argv[shapeValueAt];
const removing = argv.includes("--remove");
const [kind, name, plural] = argv.filter(
  (argument, index) => !argument.startsWith("--") && index !== shapeValueAt,
);

const kinds = ["adapter", "context", "feature"] as const;

function isKind(value: string): value is (typeof kinds)[number] {
  return kinds.includes(value as (typeof kinds)[number]);
}

/** Written and edited files are canonical only once Prettier has seen them. */
function format(result: GenerationResult | RemovalResult): void {
  const touched = [
    ...("created" in result ? result.created : []),
    ...result.edited,
  ];
  const prettierTargets = touched.filter((file) => !file.endsWith(".prisma"));

  if (prettierTargets.length > 0) {
    runCapture("pnpm", ["exec", "prettier", "--write", ...prettierTargets], {
      cwd: repositoryRoot,
    });
  }

  if (touched.some((file) => file.endsWith(".prisma"))) {
    runCapture("pnpm", ["--filter", "@ai-starter/db", "db:format"], {
      cwd: repositoryRoot,
    });
  }
}

function report(result: GenerationResult | RemovalResult): void {
  if ("created" in result) {
    for (const file of result.created) {
      console.log(`  created  ${file}`);
    }
  } else {
    for (const file of result.removed) {
      console.log(`  removed  ${file}`);
    }
  }
  for (const file of result.edited) {
    console.log(`  edited   ${file}`);
  }
  if ("skipped" in result) {
    for (const file of result.skipped) {
      console.log(`  kept     ${file} (already present)`);
    }
    for (const file of result.unchanged) {
      console.log(`  already  ${file} (registration present)`);
    }
  } else {
    for (const file of result.absent) {
      console.log(`  gone     ${file} (nothing there)`);
    }
    for (const file of result.unchanged) {
      console.log(`  clean    ${file} (no registration)`);
    }
  }

  if (result.followUps.length > 0) {
    console.log("\nNext, by hand:");
    for (const step of result.followUps) {
      console.log(`  - ${step}`);
    }
  }

  console.log(
    !("created" in result)
      ? "\nThen run `pnpm verify:changed`; what is left is expected to pass it untouched."
      : result.followUps.length > 0
        ? "\nThen run `pnpm verify:changed`; the slice is expected to pass it once the follow-ups above are done."
        : "\nThen run `pnpm verify:changed`; the generated slice is expected to pass it untouched.",
  );
}

/** Everything the arguments can be wrong about, before anything is written. */
function run(): void {
  if (process.argv.includes("--help") || kind === undefined) {
    console.log(usage);
    return;
  }

  if (!isKind(kind)) {
    console.error(`Unknown kind "${kind}".\n\n${usage}`);
    process.exitCode = 1;
    return;
  }

  if (name === undefined) {
    console.error(`\`pnpm generate ${kind}\` needs a name.\n\n${usage}`);
    process.exitCode = 1;
    return;
  }

  if (shapeValue !== undefined && !isFeatureShape(shapeValue)) {
    console.error(`Unknown shape "${shapeValue}".\n\n${shapeHelp}`);
    process.exitCode = 1;
    return;
  }

  if (kind !== "feature") {
    if (removing) {
      console.error(
        `\`--remove\` is only defined for a feature; \`pnpm generate ${kind}\` writes no registrations to reverse.`,
      );
      process.exitCode = 1;
      return;
    }
    if (shapeValue !== undefined) {
      console.error(
        `\`pnpm generate ${kind}\` takes no --shape: what it writes is identical in every shape.`,
      );
      process.exitCode = 1;
      return;
    }
    const names = featureNames(name, plural);
    const result =
      kind === "context"
        ? generateContext(repositoryRoot, names)
        : generateAdapter(repositoryRoot, names);
    format(result);
    report(result);
    return;
  }

  if (removing) {
    if (shapeValue !== undefined) {
      console.error(
        "`--remove` takes no --shape: what has to go is identified by name.",
      );
      process.exitCode = 1;
      return;
    }
    const result = removeFeature(repositoryRoot, featureNames(name, plural));
    format(result);
    report(result);
    return;
  }

  // The absence has to fail. A default here would be the imposed shape wearing
  // an argument's clothes: the reader would never see the question, which is
  // exactly how a chore board ended up describing publication.
  if (shapeValue === undefined) {
    console.error(
      `\`pnpm generate feature ${name}\` needs --shape: how ${name} records relate to each other is a decision about the product, and no answer is right by default.\n\n${shapeHelp}`,
    );
    process.exitCode = 1;
    return;
  }

  const result = generateFeature(
    repositoryRoot,
    featureNames(name, plural),
    shapeValue,
  );
  format(result);
  report(result);
}

try {
  run();
} catch (thrown) {
  console.error(thrown instanceof Error ? thrown.message : String(thrown));
  process.exitCode = 1;
}
