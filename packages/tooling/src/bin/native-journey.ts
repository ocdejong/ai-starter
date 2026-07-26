import { runInherit } from "../command.ts";
import { isMaestroInstalled, planNativeJourney } from "../native-journey.ts";
import { repositoryRoot } from "../repository.ts";

const usage = `Usage: pnpm test:e2e:mobile

Runs the Maestro flows in apps/mobile/.maestro against an installed app on a
booted simulator or device. Maestro is the one level the suite cannot run
everywhere, so this step skips — loudly — when \`maestro\` is not on PATH.
Set NATIVE_JOURNEY=required to make that skip a failure instead.`;

if (process.argv.includes("--help")) {
  console.log(usage);
} else {
  const plan = planNativeJourney({
    maestroInstalled: isMaestroInstalled(repositoryRoot),
    required: process.env.NATIVE_JOURNEY === "required",
  });

  if (plan.run) {
    process.exitCode = runInherit(
      "pnpm",
      ["--filter", "@ai-starter/mobile", "test:e2e"],
      { cwd: repositoryRoot },
    );
  } else if (plan.failed) {
    console.error(`test:e2e:mobile refused: ${plan.message ?? ""}`);
    process.exitCode = 1;
  } else {
    console.log(`test:e2e:mobile: ${plan.message ?? ""}`);
  }
}
