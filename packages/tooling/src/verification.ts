import { runInherit } from "./command.ts";

export type VerificationStep = {
  readonly name: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly env?: Readonly<Record<string, string>>;
  /** The exact command that repairs this step's failure, when one exists. */
  readonly fix?: string;
};

export const verificationLanes = [
  "checks",
  "units",
  "integration",
  "web",
  "native",
] as const;
type VerificationLane = (typeof verificationLanes)[number];
type OwnedVerificationStep = VerificationStep & {
  readonly lane: VerificationLane;
};

function script(name: string, lane: VerificationLane): OwnedVerificationStep {
  return { args: ["run", name], command: "pnpm", name, lane };
}

/**
 * The authoritative local suite and CI lane ownership. CI repeats the schema
 * validation and generated-client prerequisites in each isolated checkout.
 * Local verification stays ordered and runs each step once. The native journey
 * remains last and reports why it cannot run when no simulator is available.
 */
export const verificationSteps: readonly OwnedVerificationStep[] = [
  { ...script("format:check", "checks"), fix: "pnpm format" },
  script("instructions", "checks"),
  script("policy", "checks"),
  script("arch", "checks"),
  script("db:validate", "checks"),
  script("db:lint", "checks"),
  script("db:generate", "checks"),
  script("knip", "checks"),
  script("lint", "checks"),
  script("typecheck", "checks"),
  script("test:unit", "units"),
  script("test:integration", "integration"),
  script("build:web", "web"),
  script("build:native", "native"),
  script("db:migrate", "web"),
  { ...script("test:e2e", "web"), env: { E2E_USE_BUILD: "true" } },
  script("test:e2e:mobile", "native"),
];

export function selectVerificationLane(
  lane: string,
): readonly VerificationStep[] {
  if (!verificationLanes.some((candidate) => candidate === lane)) {
    throw new Error(
      `Unknown verification lane "${lane}". Choose ${verificationLanes.join(", ")}.`,
    );
  }
  return verificationSteps.filter(
    (step) =>
      step.lane === lane ||
      step.name === "db:validate" ||
      step.name === "db:generate",
  );
}

const stepsByName = new Map(verificationSteps.map((step) => [step.name, step]));

export function requireStep(name: string): VerificationStep {
  const step = stepsByName.get(name);
  if (step === undefined) {
    throw new Error(`Unknown verification step "${name}".`);
  }
  return step;
}

export type VerificationOutcome = {
  readonly failedStep: string | undefined;
  readonly fix: string | undefined;
  readonly code: number;
};

/** Runs steps in order and stops at the first failure so the cause stays visible. */
export function runVerification(
  root: string,
  steps: readonly VerificationStep[],
): VerificationOutcome {
  for (const [index, step] of steps.entries()) {
    console.log(`\nverify [${index + 1}/${steps.length}] ${step.name}`);
    const code = runInherit(step.command, step.args, {
      cwd: root,
      env: step.env,
    });
    if (code !== 0) {
      return { code, failedStep: step.name, fix: step.fix };
    }
  }

  return { code: 0, failedStep: undefined, fix: undefined };
}
