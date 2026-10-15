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
  "vite.config.ts",
];

/**
 * What the process-spawning tooling tests run knip and depcruise against: the
 * root configuration of the dead-code and architecture gates. `packages/tooling`
 * and `packages/config` also feed those tests, but they are harness paths and so
 * select the whole suite, `test:tooling` included.
 */
const gateConfigPaths = [
  ".dependency-cruiser.cjs",
  "knip.config.js",
  "tsconfig.depcruise.json",
];

/** The task graph cannot infer that a schema edit requires real-PostgreSQL evidence. */
const schemaPaths = ["packages/db/prisma/"];

/**
 * Packages whose behaviour is only proven against a real database and so run
 * under `test:integration` rather than the affected unit graph — the auth and
 * group flows, and the persistence adapters whose queries are the thing under
 * test, live here.
 */
const integrationBehaviourPaths = ["packages/auth/", "packages/db/"];

/**
 * Instruction and documentation surfaces. No workspace owns these at all,
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

/** The workspace a path belongs to, as the directory `pnpm-workspace.yaml` globs. */
function owningWorkspace(file: string): string | undefined {
  return /^((?:apps|packages)\/[^/]+)\//.exec(file)?.[1];
}

/**
 * Runs one package script in each changed workspace and every workspace that
 * depends on it, in dependency order. `vp run` has no git-range filter, so the
 * workspaces are named directly; `...{./dir}` adds the dependents.
 */
function affectedTask(
  name: string,
  task: string,
  workspaces: readonly string[],
): VerificationStep {
  return {
    args: [
      "exec",
      "vp",
      "run",
      ...workspaces.flatMap((workspace) => ["--filter", `...{./${workspace}}`]),
      task,
    ],
    command: "pnpm",
    name,
  };
}

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
 * Chooses the checks a change can affect. The workspace graph covers
 * package-level typecheck and unit tests, and lint runs once over the whole
 * repository because Oxlint reads one root configuration; the explicit rules
 * below cover the evidence the graph cannot infer from imports alone.
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
    requireStep("knip"),
    ...(schemaChanged
      ? [
          requireStep("db:validate"),
          requireStep("db:lint"),
          requireStep("db:generate"),
        ]
      : []),
  ];
  const reasons = [
    "Checking repository structure, the architecture graph and what nothing reaches, which any change can affect.",
  ];

  const workspaces = [
    ...new Set(changedPaths.flatMap((file) => owningWorkspace(file) ?? [])),
  ].sort((a, b) => a.localeCompare(b));
  if (workspaces.length > 0) {
    steps.push(
      requireStep("lint"),
      affectedTask("affected typecheck", "typecheck", workspaces),
      affectedTask("affected unit tests", "test", workspaces),
    );
    reasons.push(
      `Linting the repository, then typechecking and unit-testing ${workspaces.join(", ")} and what depends on them, changed since ${base}.`,
    );
  }

  // The package `test` scripts leave the minutes-long knip and depcruise tests
  // out of the affected graph; only an edit to what they exercise brings them
  // back.
  if (touches(changedPaths, gateConfigPaths)) {
    steps.push(requireStep("test:tooling"));
    reasons.push(
      "The knip or dependency-cruiser configuration changed; running the tooling tests that prove those gates still catch violations.",
    );
  }

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
    // This selection has not built web. A focused journey compiles the current
    // source in development mode instead of reading a stale production build,
    // and starts its own server: a dev server another checkout or product left
    // on the port would otherwise answer, and the journey would assert against
    // that application.
    steps.push({
      ...requireStep("test:e2e"),
      env: { E2E_REUSE_SERVER: "false", E2E_USE_BUILD: "false" },
    });
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
