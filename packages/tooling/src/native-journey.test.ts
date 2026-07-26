import { describe, expect, it } from "vitest";

import { planNativeJourney } from "./native-journey.ts";

/**
 * The one verification step that cannot run everywhere. A GitHub-hosted runner
 * has no simulator and neither does a Mac carrying only the command-line tools,
 * so the step has to decide between running Maestro and saying plainly that it
 * did not — and a downstream product whose CI *does* have a device needs a way
 * to turn the skip back into a failure.
 */

describe("planNativeJourney", () => {
  it("runs the flow when Maestro is installed", () => {
    const plan = planNativeJourney({ maestroInstalled: true, required: false });

    expect(plan.run).toBe(true);
  });

  it("skips with a reason when Maestro is absent", () => {
    const plan = planNativeJourney({
      maestroInstalled: false,
      required: false,
    });

    expect(plan.run).toBe(false);
    expect(plan.failed).toBe(false);
    expect(plan.message).toContain("maestro");
  });

  // A silent skip is how `.maestro/smoke.yaml` drifted for two stages, so the
  // message has to name what still covers the flow when the device does not.
  it("names the checks that still cover the flow when it skips", () => {
    const plan = planNativeJourney({
      maestroInstalled: false,
      required: false,
    });

    expect(plan.message).toContain("pnpm policy");
  });

  it("fails instead of skipping when the journey is required", () => {
    const plan = planNativeJourney({ maestroInstalled: false, required: true });

    expect(plan.run).toBe(false);
    expect(plan.failed).toBe(true);
    expect(plan.message).toContain("NATIVE_JOURNEY");
  });

  it("runs the flow when it is required and Maestro is installed", () => {
    const plan = planNativeJourney({ maestroInstalled: true, required: true });

    expect(plan).toEqual({ failed: false, message: undefined, run: true });
  });
});
