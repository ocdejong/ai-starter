import { ArgumentError, parseArguments } from "../argv.ts";
import { selectChecks } from "../change-selection.ts";
import { changedPaths, GitError, resolveBase } from "../git.ts";
import { repositoryRoot } from "../repository.ts";
import { runVerification } from "../verification.ts";

const usage = `Usage: pnpm verify:changed [--base <revision>]

Runs only the checks the current changes can affect. \`pnpm verify\` remains the
authoritative suite and is what CI runs.`;

function main(): number {
  let parsed;
  try {
    parsed = parseArguments(process.argv.slice(2), {
      flags: ["base"],
      switches: ["help"],
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

  let base: string;
  let changed: string[];
  try {
    base = resolveBase(repositoryRoot, parsed.flags.get("base"));
    changed = changedPaths(repositoryRoot, base);
  } catch (error) {
    if (error instanceof GitError) {
      console.error(
        `${error.message}\nfix: run \`pnpm verify\` instead, or pass an explicit --base revision.`,
      );
      return 1;
    }
    throw error;
  }

  const selection = selectChecks(changed, base);

  console.log(
    `verify:changed: ${changed.length} changed path(s) since ${base}`,
  );
  for (const reason of selection.reasons) {
    console.log(`  - ${reason}`);
  }

  if (selection.steps.length === 0) {
    return 0;
  }

  const outcome = runVerification(repositoryRoot, selection.steps);

  if (outcome.failedStep !== undefined) {
    console.error(
      `\nverify:changed: \`${outcome.failedStep}\` failed with exit code ${outcome.code}.`,
    );
  }

  return outcome.code;
}

process.exitCode = main();
