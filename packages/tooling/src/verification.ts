import { runInherit } from "./command.ts";

export type VerificationStep = {
  readonly name: string;
  readonly command: string;
  readonly args: readonly string[];
};

function script(name: string): VerificationStep {
  return { args: ["run", name], command: "pnpm", name };
}

/**
 * The authoritative verification suite, in the order CI runs it: cheap
 * deterministic feedback first, then integration, build and browser evidence.
 * The generated Prisma client is an input to every step that compiles
 * TypeScript, so `db:generate` runs before `lint` and `typecheck` — a checkout
 * whose client predates a pulled schema change would otherwise fail typecheck
 * with property errors that never name `pnpm db:generate` as the fix.
 * `pnpm verify`, the CI workflow and `docs/testing.md` all read this one list.
 */
export const verificationSteps: readonly VerificationStep[] = [
  script("format:check"),
  script("instructions"),
  script("policy"),
  script("arch"),
  script("db:validate"),
  script("db:generate"),
  script("lint"),
  script("typecheck"),
  script("test:unit"),
  script("test:integration"),
  script("build"),
  script("db:migrate"),
  script("test:e2e"),
];

export const stepsByName = new Map(
  verificationSteps.map((step) => [step.name, step]),
);

export function requireStep(name: string): VerificationStep {
  const step = stepsByName.get(name);
  if (step === undefined) {
    throw new Error(`Unknown verification step "${name}".`);
  }
  return step;
}

export type VerificationOutcome = {
  readonly failedStep: string | undefined;
  readonly code: number;
};

/** Runs steps in order and stops at the first failure so the cause stays visible. */
export function runVerification(
  root: string,
  steps: readonly VerificationStep[],
): VerificationOutcome {
  for (const [index, step] of steps.entries()) {
    console.log(`\nverify [${index + 1}/${steps.length}] ${step.name}`);
    const code = runInherit(step.command, step.args, { cwd: root });
    if (code !== 0) {
      return { code, failedStep: step.name };
    }
  }

  return { code: 0, failedStep: undefined };
}
