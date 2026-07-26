import { runCapture } from "./command.ts";

export type NativeJourneyPlan = {
  readonly run: boolean;
  readonly failed: boolean;
  readonly message: string | undefined;
};

export type NativeJourneyEnvironment = {
  readonly maestroInstalled: boolean;
  readonly required: boolean;
};

/**
 * Whether the native journey can run here, and what to say when it cannot.
 *
 * Maestro needs an installed app and a booted simulator, which a GitHub-hosted
 * runner does not have. The step therefore skips rather than fails by default —
 * but a skip that says nothing is what let the flow rot, so the message names
 * both the missing tool and the checks that still cover the file. Setting
 * `NATIVE_JOURNEY=required` turns the skip into a failure, which is what a
 * downstream product's device lane wants.
 */
export function planNativeJourney(
  environment: NativeJourneyEnvironment,
): NativeJourneyPlan {
  if (environment.maestroInstalled) {
    return { failed: false, message: undefined, run: true };
  }

  if (environment.required) {
    return {
      failed: true,
      message:
        "NATIVE_JOURNEY=required, but `maestro` is not on PATH. Install it (https://maestro.dev) and boot a simulator, or unset NATIVE_JOURNEY to let this step skip.",
      run: false,
    };
  }

  return {
    failed: false,
    message:
      "Skipping the native journey: `maestro` is not on PATH, and it needs an installed app plus a booted simulator. " +
      "`pnpm policy` still checks the flow's application id and that every message it asserts is one the product ships; " +
      "`test:unit`, `typecheck` and `build` still cover the native components. " +
      "Install Maestro to run it here, or set NATIVE_JOURNEY=required to make this a failure.",
    run: false,
  };
}

export function isMaestroInstalled(cwd: string): boolean {
  return runCapture("maestro", ["--version"], { cwd }).code === 0;
}
