import {
  requireStep,
  verificationSteps,
  type VerificationStep,
} from "./verification.ts";

export type ChangeSelection = {
  readonly steps: readonly VerificationStep[];
  readonly reasons: readonly string[];
};

/**
 * Files that change what every other check means. A change here cannot be
 * attributed to one package, so the authoritative suite runs instead.
 */
const harnessPaths = [
  ".github/workflows/",
  "package.json",
  "packages/config/",
  "packages/tooling/",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "prettier.config.js",
  "turbo.json",
];

/** Turborepo cannot infer that a schema edit requires real-PostgreSQL evidence. */
const schemaPaths = ["packages/db/prisma/"];

/**
 * Instruction and documentation surfaces. Turborepo cannot see these at all,
 * yet an edit here is exactly what makes a pointer stale or a link dangle.
 */
const instructionPaths = [
  ".cursor/",
  ".github/copilot-instructions.md",
  "AGENTS.md",
  "CLAUDE.md",
  "CONTRIBUTING.md",
  "GEMINI.md",
  "README.md",
  "SECURITY.md",
  "docs/",
];

/** Paths whose behaviour is only observable through the browser journey. */
const webBehaviourPaths = ["apps/web/", "packages/api/", "packages/domain/"];

function touches(
  changed: readonly string[],
  prefixes: readonly string[],
): boolean {
  return changed.some((file) =>
    prefixes.some((prefix) =>
      prefix.endsWith("/") ? file.startsWith(prefix) : file === prefix,
    ),
  );
}

/**
 * Chooses the checks a change can affect. Turborepo's affected graph covers
 * package-level lint, typecheck and unit tests; the explicit rules below cover
 * the evidence the graph cannot infer from imports alone.
 */
export function selectChecks(
  changedPaths: readonly string[],
  base: string,
): ChangeSelection {
  if (changedPaths.length === 0) {
    return { reasons: ["No changes against the base revision."], steps: [] };
  }

  if (touches(changedPaths, harnessPaths)) {
    return {
      reasons: [
        "Repository harness or workspace configuration changed; running the authoritative suite.",
      ],
      steps: verificationSteps,
    };
  }

  const steps: VerificationStep[] = [
    requireStep("format:check"),
    requireStep("policy"),
    requireStep("arch"),
    {
      args: [
        "exec",
        "turbo",
        "run",
        "lint",
        "typecheck",
        "test",
        `--filter=...[${base}]`,
      ],
      command: "pnpm",
      name: "affected lint, typecheck and unit tests",
    },
  ];
  const reasons = [
    "Checking repository structure and the architecture graph, which any change can affect.",
    `Linting, typechecking and unit-testing packages affected since ${base}.`,
  ];

  if (
    touches(changedPaths, instructionPaths) ||
    changedPaths.some((file) => file.endsWith("/AGENTS.md"))
  ) {
    steps.push(requireStep("instructions"));
    reasons.push(
      "An agent instruction surface or referenced document changed; rechecking the instruction policy.",
    );
  }

  if (touches(changedPaths, schemaPaths)) {
    steps.push(
      requireStep("db:validate"),
      requireStep("db:generate"),
      requireStep("test:integration"),
    );
    reasons.push(
      "The Prisma schema or a migration changed; validating it and running the real-PostgreSQL tests.",
    );
  }

  if (touches(changedPaths, webBehaviourPaths)) {
    steps.push(requireStep("test:e2e"));
    reasons.push(
      "Web-observable behaviour changed; running the browser journey.",
    );
  }

  return { reasons, steps };
}
