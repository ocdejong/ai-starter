import { describe, expect, it } from "vitest";

import { planDemoSeed, type DemoSeedPlan } from "./demo-seed-plan";

const databaseUrl = "postgresql://user:pw@localhost:5440/app";
const acknowledgement = "confirmed-local";

/** Asserts the plan refused and hands back the reason it gave. */
function refusal(plan: DemoSeedPlan): string {
  if (plan.run) {
    throw new Error("expected the seed to be refused, but it was allowed");
  }
  return plan.message;
}

describe("planDemoSeed", () => {
  it("runs when the wrapper has confirmed the target is local", () => {
    const plan = planDemoSeed({ acknowledgement, databaseUrl });

    expect(plan.run).toBe(true);
  });

  it("refuses when nothing confirmed the target, however local it looks", () => {
    // The host check belongs to `pnpm db:seed`, which owns it and passes this
    // through. Running the inner bin directly skips that check entirely, and a
    // loopback-looking URL is not the same fact as a checked one — an SSH
    // tunnel to production is spelled `localhost` too.
    const plan = planDemoSeed({ acknowledgement: undefined, databaseUrl });

    expect(refusal(plan)).toContain("pnpm db:seed");
  });

  it("refuses an acknowledgement that is not the one the wrapper sends", () => {
    const plan = planDemoSeed({ acknowledgement: "true", databaseUrl });

    expect(plan.run).toBe(false);
  });

  it("refuses when no database is configured at all", () => {
    const plan = planDemoSeed({ acknowledgement, databaseUrl: undefined });

    expect(refusal(plan)).toContain("DATABASE_URL");
  });
});
