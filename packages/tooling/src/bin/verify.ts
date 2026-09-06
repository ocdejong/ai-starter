import { parseArguments } from "../argv.ts";
import { repositoryRoot } from "../repository.ts";
import {
  runVerification,
  selectVerificationLane,
  verificationLanes,
  verificationSteps,
} from "../verification.ts";

const usage = `Usage: pnpm verify [--lane <name>]

Runs the complete authoritative suite locally, or one CI lane.
Lanes: ${verificationLanes.join(", ")}

Full suite:
${verificationSteps.map((step) => `  ${step.name}`).join("\n")}`;

function main(): number {
  const parsed = parseArguments(process.argv.slice(2), {
    flags: ["lane"],
    switches: ["help"],
  });
  if (parsed.switches.has("help")) {
    console.log(usage);
    return 0;
  }
  const lane = parsed.flags.get("lane");
  const steps =
    lane === undefined ? verificationSteps : selectVerificationLane(lane);
  const outcome = runVerification(repositoryRoot, steps);

  if (outcome.failedStep === undefined) {
    console.log(
      `\nverify: all ${steps.length} checks passed: ${steps
        .map((step) => step.name)
        .join(", ")}`,
    );
  } else {
    const remedy =
      outcome.fix === undefined
        ? "Fix the cause above"
        : `Run \`${outcome.fix}\``;
    console.error(
      `\nverify: \`${outcome.failedStep}\` failed with exit code ${outcome.code}. ${remedy} and run \`pnpm verify\` again.`,
    );
  }

  return outcome.code;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
