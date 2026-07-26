import { repositoryRoot } from "../repository.ts";
import { runVerification, verificationSteps } from "../verification.ts";

const usage = `Usage: pnpm verify

Runs the complete authoritative verification suite, in the same order as CI:
${verificationSteps.map((step) => `  ${step.name}`).join("\n")}`;

if (process.argv.includes("--help")) {
  console.log(usage);
} else {
  const outcome = runVerification(repositoryRoot, verificationSteps);

  if (outcome.failedStep === undefined) {
    console.log(
      `\nverify: all ${verificationSteps.length} checks passed: ${verificationSteps
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

  process.exitCode = outcome.code;
}
