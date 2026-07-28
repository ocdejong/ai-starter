import { runCapture } from "../command.ts";
import {
  generateAdapter,
  generateContext,
  generateFeature,
  type GenerationResult,
} from "../generators/feature.ts";
import { featureNames } from "../generators/naming.ts";
import { repositoryRoot } from "../repository.ts";

const usage = `Usage: pnpm generate <context|feature|adapter> <name> [plural]

Writes a slice of the shape this repository already uses, in the product's own
words, and registers it everywhere it has to be registered.

  context   A bounded context in packages/domain: schemas, invariants and the
            stable validation codes an interface translates.
  feature   The whole vertical slice — the context, a consumer-owned port, a
            Prisma adapter with its transaction, a group-scoped tRPC router,
            web and native screens, and tests at every layer.
  adapter   A port for an external service and a vendor-free adapter behind it,
            with a timeout, a parsed response, translated errors and redaction.

<name> is a lower-case, kebab-case, singular noun: "invoice", "release-note".
Give [plural] only when English needs help: \`pnpm generate feature person people\`.

Two things it cannot do for you, and says so when it finishes: creating the
migration (Prisma cannot express a partial index or a CHECK, so that SQL is
written by hand) and translating the Dutch catalog entries, which \`pnpm policy\`
reports as untranslated until somebody writes them.`;

const [kind, name, plural] = process.argv.slice(2);

const generators = {
  adapter: generateAdapter,
  context: generateContext,
  feature: generateFeature,
};

function isKind(value: string): value is keyof typeof generators {
  return Object.hasOwn(generators, value);
}

/** Generated files are canonical only once Prettier has seen them. */
function format(result: GenerationResult): void {
  const touched = [...result.created, ...result.edited];
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

function report(result: GenerationResult): void {
  for (const file of result.created) {
    console.log(`  created  ${file}`);
  }
  for (const file of result.edited) {
    console.log(`  edited   ${file}`);
  }
  for (const file of result.skipped) {
    console.log(`  kept     ${file} (already present)`);
  }
  for (const file of result.unchanged) {
    console.log(`  already  ${file} (registration present)`);
  }

  if (result.followUps.length > 0) {
    console.log("\nNext, by hand:");
    for (const step of result.followUps) {
      console.log(`  - ${step}`);
    }
  }

  console.log(
    result.followUps.length > 0
      ? "\nThen run `pnpm verify:changed`; the slice is expected to pass it once the follow-ups above are done."
      : "\nThen run `pnpm verify:changed`; the generated slice is expected to pass it untouched.",
  );
}

if (process.argv.includes("--help") || kind === undefined) {
  console.log(usage);
} else if (!isKind(kind)) {
  console.error(`Unknown kind "${kind}".\n\n${usage}`);
  process.exitCode = 1;
} else if (name === undefined) {
  console.error(`\`pnpm generate ${kind}\` needs a name.\n\n${usage}`);
  process.exitCode = 1;
} else {
  try {
    const names = featureNames(name, plural);
    const result = generators[kind](repositoryRoot, names);
    format(result);
    report(result);
  } catch (thrown) {
    console.error(thrown instanceof Error ? thrown.message : String(thrown));
    process.exitCode = 1;
  }
}
