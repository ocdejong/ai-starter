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
 * Packages whose behaviour is only proven against a real database and so run
 * under `test:integration` rather than the affected unit graph — the auth and
 * group flows, and the persistence adapters whose queries are the thing under
 * test, live here.
 */
const integrationBehaviourPaths = ["packages/auth/", "packages/db/"];

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

/**
 * Paths whose behaviour is only observable through the browser journey. Wider
 * than "the web app": the journeys sign accounts up through the real auth
 * server, read the dev mailbox and click the link an email template rendered,
 * and assert copy by the text a catalog supplies — so each of those packages can
 * break a journey while every unit suite stays green. `packages/tokens/` is
 * deliberately absent: it reaches the browser as colours no journey asserts, and
 * the generated stylesheet is kept honest by a unit test.
 */
const webBehaviourPaths = [
  "apps/web/",
  "packages/api/",
  "packages/auth/",
  "packages/db/",
  "packages/domain/",
  "packages/email/",
  "packages/i18n/",
];

/**
 * Paths whose behaviour is only observable on a device. The flow addresses the
 * app by its own screens and asserts catalog copy by its rendered text, so a
 * catalog edit can invalidate it as surely as a screen edit can.
 */
const nativeBehaviourPaths = ["apps/mobile/", "packages/i18n/"];

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

  // The affected packages typecheck against the generated Prisma client, so a
  // schema change must regenerate it before that step, not after.
  const schemaChanged = touches(changedPaths, schemaPaths);

  const steps: VerificationStep[] = [
    requireStep("format:check"),
    requireStep("policy"),
    requireStep("arch"),
    ...(schemaChanged
      ? [
          requireStep("db:validate"),
          requireStep("db:lint"),
          requireStep("db:generate"),
        ]
      : []),
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

  if (schemaChanged) {
    steps.push(requireStep("test:integration"));
    reasons.push(
      "The Prisma schema or a migration changed; validating it, linting the migration SQL, regenerating the client, and running the real-PostgreSQL tests.",
    );
  } else if (touches(changedPaths, integrationBehaviourPaths)) {
    // Guarded by the schema branch so `test:integration` is never selected twice.
    steps.push(requireStep("test:integration"));
    reasons.push(
      "A database-backed flow package changed; running the real-PostgreSQL integration tests.",
    );
  }

  if (touches(changedPaths, webBehaviourPaths)) {
    steps.push(requireStep("test:e2e"));
    reasons.push(
      "Web-observable behaviour changed; running the browser journey.",
    );
  }

  if (touches(changedPaths, nativeBehaviourPaths)) {
    steps.push(requireStep("test:e2e:mobile"));
    reasons.push(
      "Native-observable behaviour changed; running the native journey, which skips with a reason where no device exists.",
    );
  }

  return { reasons, steps };
}
