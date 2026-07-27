import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { ArgumentError, parseArguments } from "../argv.ts";
import { repositoryRoot } from "../repository.ts";
import {
  discardCheckout,
  removeDatabaseContainer,
  runRehearsal,
} from "../template-rehearsal.ts";

const usage = `Usage: pnpm rehearse:template [--into <directory>] [--keep]

Instantiates this repository as a downstream product would receive it, renames
it with \`pnpm starter:init\`, bootstraps it from nothing, runs every generator,
finishes the migration the feature generator cannot write, and runs the whole
authoritative suite over the result.

It is the only check that compiles what \`pnpm generate adapter\` emits, and the
only one that executes the migration follow-up rather than printing it. Expect
it to take as long as a full \`pnpm verify\` plus an install.

  --into   Where to instantiate. Defaults to a fresh temporary directory.
  --keep   Leave the checkout and its database container behind for inspection.`;

async function main(): Promise<number> {
  let parsed;
  try {
    parsed = parseArguments(process.argv.slice(2), {
      flags: ["into"],
      switches: ["help", "keep"],
    });
  } catch (error) {
    if (error instanceof ArgumentError) {
      console.error(`${error.message}\n\n${usage}`);
      return 2;
    }
    throw error;
  }

  if (parsed.switches.has("help")) {
    console.log(usage);
    return 0;
  }

  const into = parsed.flags.get("into");
  // Resolved through `realpath`: the system temporary directory is reached
  // through a symlink on macOS, and Knip then relates no import to the file it
  // resolves to, reporting every module below an entry point as unreached.
  const checkout =
    into === undefined
      ? realpathSync(mkdtempSync(path.join(tmpdir(), "starter-rehearsal-")))
      : path.resolve(into);

  const keep = parsed.switches.has("keep");
  const outcome = await runRehearsal(repositoryRoot, checkout);

  if (outcome.failed !== undefined) {
    console.error(
      `\nrehearse: the template failed at "${outcome.failed.name}".` +
        `\n  reproduce: cd ${checkout} && ${outcome.failed.command}` +
        `\n  This is generated code, so the fix belongs in the generator or its` +
        ` templates, never in the checkout above.`,
    );
  } else {
    console.log(
      "\nrehearse: a fresh template initialised, bootstrapped, grew a context," +
        " a feature and an adapter, and passed the whole suite.",
    );
  }

  if (keep) {
    console.log(`rehearse: keeping ${checkout}`);
  } else {
    removeDatabaseContainer(checkout);
    discardCheckout(checkout);
  }

  return outcome.code === 0 ? 0 : 1;
}

process.exitCode = await main();
