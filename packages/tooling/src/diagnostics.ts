import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { runCapture } from "./command.ts";
import { probeContainerRuntime } from "./container-runtime.ts";
import { DatabaseUrlError, parseDatabaseUrl } from "./database-url.ts";
import { parseEnvFile } from "./env-file.ts";
import {
  generatedClientPath,
  mobileEnvPath,
  prismaSchemaPath,
  readRootManifest,
  webEnvPath,
} from "./repository.ts";
import { isPortAccepting } from "./tcp.ts";

type CheckStatus = "ok" | "warning" | "failure";

export type Check = {
  readonly name: string;
  readonly status: CheckStatus;
  readonly detail: string;
  /** The exact next command or edit that resolves a warning or failure. */
  readonly fix?: string;
};

/** Reads the minimum major version out of an `engines.node` range such as `^24 || >=26`. */
export function minimumMajor(range: string): number | undefined {
  const match = /(\d+)/.exec(range);
  return match?.[1] === undefined ? undefined : Number(match[1]);
}

/**
 * Evaluates an `engines.node` range against one major version: `||`-separated
 * clauses, each a space-separated list of `^`, `~`, `>=`, `<` or bare
 * comparators that must all hold. Major granularity is deliberate — Node
 * support (and the LTS distinction dependency-cruiser enforces) moves per
 * major, and staying dependency-free rules out a full semver library. Returns
 * undefined when any clause is unreadable so callers degrade to a warning.
 */
export function rangeAllowsMajor(
  range: string,
  major: number,
): boolean | undefined {
  let allowed = false;
  for (const clause of range.split("||")) {
    const satisfied = clauseAllowsMajor(clause.trim(), major);
    if (satisfied === undefined) {
      return undefined;
    }
    allowed ||= satisfied;
  }
  return allowed;
}

function clauseAllowsMajor(clause: string, major: number): boolean | undefined {
  const comparators = clause.split(/\s+/).filter((part) => part !== "");
  if (comparators.length === 0) {
    return undefined;
  }

  let satisfied = true;
  for (const comparator of comparators) {
    const match = /^(\^|~|>=|<)?v?(\d+)(?:\.\d+(?:\.\d+)?)?$/.exec(comparator);
    if (match?.[2] === undefined) {
      return undefined;
    }

    const bound = Number(match[2]);
    satisfied &&=
      match[1] === ">="
        ? major >= bound
        : match[1] === "<"
          ? major < bound
          : major === bound;
  }
  return satisfied;
}

export function majorOf(version: string): number | undefined {
  const match = /(\d+)/.exec(version.replace(/^v/, ""));
  return match?.[1] === undefined ? undefined : Number(match[1]);
}

/** Extracts `10.32.1` from the `pnpm@10.32.1` corepack pin. */
export function pinnedVersion(packageManager: string): string | undefined {
  const [, version] = packageManager.split("@");
  return version?.split("+")[0];
}

export function hasFailure(checks: readonly Check[]): boolean {
  return checks.some((check) => check.status === "failure");
}

const symbols: Record<CheckStatus, string> = {
  failure: "FAIL",
  ok: "OK  ",
  warning: "WARN",
};

export function formatChecks(checks: readonly Check[]): string {
  return checks
    .map((check) => {
      const head = `${symbols[check.status]}  ${check.name}: ${check.detail}`;
      return check.fix === undefined
        ? head
        : `${head}\n        fix: ${check.fix}`;
    })
    .join("\n");
}

export async function runDiagnostics(root: string): Promise<Check[]> {
  const checks: Check[] = [
    checkNode(root),
    checkPnpm(root),
    checkDependencies(root),
  ];
  checks.push(checkContainerRuntime(root));

  const environment = checkWebEnvironment(root);
  checks.push(environment.check);
  checks.push(checkMobileEnvironment(root));
  checks.push(checkEmail(root));
  checks.push(checkDevMailbox(root));
  checks.push(checkChat(root));
  checks.push(checkSocialSignIn(root));
  checks.push(checkRateLimit(root));
  checks.push(checkErrorReporting(root));
  checks.push(await checkPostgres(environment.databaseUrl));
  checks.push(checkGeneratedClient(root));

  return checks;
}

function checkNode(root: string): Check {
  return nodeCheck(
    readRootManifest(root).requiredNodeRange,
    process.versions.node,
  );
}

/**
 * Pure so the range logic is unit-testable. The range must be evaluated in
 * full, not reduced to its floor: engines.node excludes the non-LTS majors
 * that dependency-cruiser (`pnpm arch`, part of `pnpm verify`) hard-exits on,
 * so a Node this check blesses cannot fail verify on version alone.
 */
export function nodeCheck(range: string | undefined, version: string): Check {
  const major = majorOf(version);
  const allowed =
    range === undefined || major === undefined
      ? undefined
      : rangeAllowsMajor(range, major);

  if (range === undefined || major === undefined || allowed === undefined) {
    return {
      detail: `Running Node.js ${version}; package.json declares no readable engines.node range.`,
      name: "Node.js",
      status: "warning",
    };
  }

  if (allowed) {
    return {
      detail: `Node.js ${version} satisfies ${range}.`,
      name: "Node.js",
      status: "ok",
    };
  }

  const floor = minimumMajor(range);
  const fix =
    "Switch to Node.js 24 — the repository pins it in .node-version; `nvm use`, `fnm use`, or `mise use` picks it up.";

  return floor !== undefined && major < floor
    ? {
        detail: `Node.js ${version} is older than the required ${range}.`,
        fix,
        name: "Node.js",
        status: "failure",
      }
    : {
        detail: `Node.js ${version} does not satisfy ${range}; dependency-cruiser (\`pnpm arch\`, part of \`pnpm verify\`) refuses non-LTS majors.`,
        fix,
        name: "Node.js",
        status: "failure",
      };
}

function checkPnpm(root: string): Check {
  const result = runCapture("pnpm", ["--version"], { cwd: root });
  if (result.code !== 0) {
    return {
      detail: "pnpm is not on PATH.",
      fix: "Enable it with `corepack enable pnpm`, or install pnpm 10 globally.",
      name: "pnpm",
      status: "failure",
    };
  }

  const actual = result.stdout.trim();
  const pin = readRootManifest(root).packageManager;
  const expected = pin === undefined ? undefined : pinnedVersion(pin);

  if (expected === undefined || majorOf(actual) === majorOf(expected)) {
    return {
      detail: `pnpm ${actual} is available.`,
      name: "pnpm",
      status: "ok",
    };
  }

  return {
    detail: `pnpm ${actual} does not match the pinned ${expected}.`,
    fix: "Run `corepack enable pnpm` so the version in package.json#packageManager is used.",
    name: "pnpm",
    status: "warning",
  };
}

function checkDependencies(root: string): Check {
  return existsSync(path.join(root, "node_modules"))
    ? {
        detail: "Workspace dependencies are installed.",
        name: "Dependencies",
        status: "ok",
      }
    : {
        detail: "node_modules is missing.",
        fix: "Run `pnpm bootstrap`.",
        name: "Dependencies",
        status: "failure",
      };
}

function checkContainerRuntime(root: string): Check {
  const probe = probeContainerRuntime(root);

  if (probe.runtime !== undefined) {
    return {
      detail: `${probe.runtime} is installed and responding.`,
      name: "Container runtime",
      status: "ok",
    };
  }

  if (probe.installed.length > 0) {
    return {
      detail: `${probe.installed.join(" and ")} is installed but the daemon is not responding.`,
      fix: `Start ${probe.installed[0] ?? "the container runtime"} and run \`pnpm diagnose\` again.`,
      name: "Container runtime",
      status: "failure",
    };
  }

  return {
    detail: "Neither Docker nor Podman is installed.",
    fix: "Install Docker Desktop (https://docs.docker.com/engine/install/) or Podman (https://podman.io/getting-started/installation). The local database and the integration tests both need one.",
    name: "Container runtime",
    status: "failure",
  };
}

type EnvironmentCheck = {
  readonly check: Check;
  readonly databaseUrl: string | undefined;
};

function checkWebEnvironment(root: string): EnvironmentCheck {
  const absolute = path.join(root, webEnvPath);
  if (!existsSync(absolute)) {
    return {
      check: {
        detail: `${webEnvPath} is missing.`,
        fix: "Run `pnpm bootstrap`, which creates it from apps/web/.env.example.",
        name: "Web environment",
        status: "failure",
      },
      databaseUrl: undefined,
    };
  }

  const values = parseEnvFile(readFileSync(absolute, "utf8"));
  const databaseUrl = values.get("DATABASE_URL");

  if (databaseUrl === undefined || databaseUrl === "") {
    return {
      check: {
        detail: `${webEnvPath} does not set DATABASE_URL.`,
        fix: "Copy the DATABASE_URL line from apps/web/.env.example.",
        name: "Web environment",
        status: "failure",
      },
      databaseUrl: undefined,
    };
  }

  try {
    parseDatabaseUrl(databaseUrl);
  } catch (error) {
    return {
      check: {
        detail:
          error instanceof DatabaseUrlError ? error.message : String(error),
        fix: "Correct DATABASE_URL in apps/web/.env.",
        name: "Web environment",
        status: "failure",
      },
      databaseUrl: undefined,
    };
  }

  // The origin the auth server builds emailed action links from, and the one
  // the browser suite drives. A link built from a wrong origin lands on a server
  // that cannot see the cookie, which reads as a broken flow rather than a
  // broken variable.
  const authUrl = values.get("BETTER_AUTH_URL") ?? "";
  if (!URL.canParse(authUrl)) {
    return {
      check: {
        detail:
          authUrl === ""
            ? `${webEnvPath} does not set BETTER_AUTH_URL, so emailed sign-in and reset links have no origin.`
            : `${webEnvPath} sets BETTER_AUTH_URL to "${authUrl}", which is not a URL.`,
        fix: "Set BETTER_AUTH_URL to this checkout's own origin, or run `pnpm bootstrap`, which derives one.",
        name: "Web environment",
        status: "failure",
      },
      databaseUrl,
    };
  }

  const secret = values.get("BETTER_AUTH_SECRET") ?? "";
  if (secret.length < 32) {
    return {
      check: {
        detail: `${webEnvPath} has no usable BETTER_AUTH_SECRET; the production build validates it.`,
        fix: "Run `pnpm bootstrap`, which generates one when the value is empty.",
        name: "Web environment",
        status: "warning",
      },
      databaseUrl,
    };
  }

  return {
    check: {
      detail: `${webEnvPath} defines DATABASE_URL, BETTER_AUTH_URL and BETTER_AUTH_SECRET.`,
      name: "Web environment",
      status: "ok",
    },
    databaseUrl,
  };
}

function checkMobileEnvironment(root: string): Check {
  return existsSync(path.join(root, mobileEnvPath))
    ? {
        detail: `${mobileEnvPath} is present.`,
        name: "Mobile environment",
        status: "ok",
      }
    : {
        detail: `${mobileEnvPath} is missing; Expo falls back to the bundled defaults.`,
        fix: "Run `pnpm bootstrap`, or copy apps/mobile/.env.example.",
        name: "Mobile environment",
        status: "warning",
      };
}

/**
 * The transactional-email configuration is deliberately optional: a keyless
 * clone must still boot and degrade to the local dev mailbox. Pure so the
 * branch logic is unit-testable without an env-file fixture.
 */
export function emailCheck(
  apiKey: string | undefined,
  from: string | undefined,
): Check {
  if (apiKey === undefined || apiKey === "") {
    return {
      detail:
        "No RESEND_API_KEY; email is written to the local dev mailbox (.mail/) instead of sent.",
      name: "Transactional email",
      status: "ok",
    };
  }

  if (!apiKey.startsWith("re_")) {
    return {
      detail: "RESEND_API_KEY is set but does not begin with re_.",
      fix: 'Use a Resend API key that begins with "re_", or clear RESEND_API_KEY to use the dev mailbox.',
      name: "Transactional email",
      status: "failure",
    };
  }

  if (from === undefined || from === "") {
    return {
      detail:
        "RESEND_API_KEY is set but EMAIL_FROM is empty, so Resend falls back to onboarding@resend.dev.",
      fix: 'Set EMAIL_FROM to an email address or "Name <address>" in apps/web/.env.',
      name: "Transactional email",
      status: "warning",
    };
  }

  return {
    detail:
      "RESEND_API_KEY and EMAIL_FROM are set; email sends through Resend.",
    name: "Transactional email",
    status: "ok",
  };
}

/**
 * The default the web app falls back to when `AI_CHAT_MODEL` is unset. Kept in
 * step with the schema in apps/web/src/env.js so the report names the model the
 * app would actually use.
 */
const defaultChatModel = "claude-sonnet-5";

/**
 * Chat configuration is optional in the same way email is: a keyless clone must
 * boot and say so rather than fail. Pure so the branch logic is unit-testable
 * without an env-file fixture.
 */
export function chatCheck(
  apiKey: string | undefined,
  model: string | undefined,
): Check {
  if (apiKey === undefined || apiKey === "") {
    return {
      detail:
        "No ANTHROPIC_API_KEY; the landing-page chat renders its not configured state instead of answering.",
      name: "LLM chat",
      status: "ok",
    };
  }

  if (!apiKey.startsWith("sk-ant-")) {
    return {
      detail: "ANTHROPIC_API_KEY is set but does not begin with sk-ant-.",
      fix: 'Use an Anthropic API key that begins with "sk-ant-", or clear ANTHROPIC_API_KEY to leave chat unconfigured.',
      name: "LLM chat",
      status: "failure",
    };
  }

  const resolved =
    model === undefined || model === "" ? defaultChatModel : model;
  return {
    detail: `ANTHROPIC_API_KEY is set; chat answers with ${resolved}.`,
    name: "LLM chat",
    status: "ok",
  };
}

/**
 * Social sign-in is optional, and half of a pair configures nothing — which is
 * the state worth reporting, because the landing page silently falls back to the
 * hint and nothing else says why. Pure so the branch logic is unit-testable.
 */
export function socialSignInCheck(
  credentials: Readonly<Record<string, string | undefined>>,
): Check {
  const providers = [
    { id: "BETTER_AUTH_GOOGLE_CLIENT_ID", name: "Google" },
    { id: "BETTER_AUTH_GITHUB_CLIENT_ID", name: "GitHub" },
  ].map(({ id, name }) => ({
    clientId: credentials[id] ?? "",
    clientSecret: credentials[id.replace("_ID", "_SECRET")] ?? "",
    name,
  }));

  const half = providers.find(
    (provider) => (provider.clientId === "") !== (provider.clientSecret === ""),
  );
  if (half !== undefined) {
    return {
      detail: `${half.name} has only one half of its OAuth pair, so no provider button is offered.`,
      fix: `Set both BETTER_AUTH_${half.name.toUpperCase()}_CLIENT_ID and BETTER_AUTH_${half.name.toUpperCase()}_CLIENT_SECRET in apps/web/.env, or clear both.`,
      name: "Social sign-in",
      status: "warning",
    };
  }

  const configured = providers.filter(
    (provider) => provider.clientId !== "" && provider.clientSecret !== "",
  );
  if (configured.length === 0) {
    return {
      detail:
        "No OAuth credentials; the landing page offers email sign-in and says how to add a provider.",
      name: "Social sign-in",
      status: "ok",
    };
  }

  return {
    detail: `${configured.map((provider) => provider.name).join(" and ")} configured; the landing page offers ${configured[0]?.name ?? ""}.`,
    name: "Social sign-in",
    status: "ok",
  };
}

/**
 * Error reporting is off without a DSN, by design. The build-time trio is
 * reported separately because it uploads source maps and is easy to half-set.
 */
export function errorReportingCheck(
  dsn: string | undefined,
  sourceMapCredentials: Readonly<Record<string, string | undefined>>,
): Check {
  const missing = ["SENTRY_ORG", "SENTRY_PROJECT", "SENTRY_AUTH_TOKEN"].filter(
    (name) => (sourceMapCredentials[name] ?? "") === "",
  );

  if (dsn === undefined || dsn === "") {
    return {
      detail:
        "No NEXT_PUBLIC_SENTRY_DSN; Sentry stays disabled and nothing is reported.",
      name: "Error reporting",
      status: "ok",
    };
  }

  if (missing.length > 0 && missing.length < 3) {
    return {
      detail: `NEXT_PUBLIC_SENTRY_DSN is set; source-map upload is half-configured (missing ${missing.join(", ")}).`,
      fix: `Set ${missing.join(" and ")} in apps/web/.env, or clear all three to skip source-map upload.`,
      name: "Error reporting",
      status: "warning",
    };
  }

  return {
    detail:
      missing.length === 3
        ? "NEXT_PUBLIC_SENTRY_DSN is set; errors are reported without uploaded source maps."
        : "NEXT_PUBLIC_SENTRY_DSN is set and the build can upload source maps.",
    name: "Error reporting",
    status: "ok",
  };
}

/**
 * The one variable in this repository that turns a security control off.
 *
 * It exists for the browser suite, whose journeys all share one address, and a
 * checkout that has it set has no brute-force guard on its auth endpoints. That
 * is a failure rather than a warning: nothing else would ever say so, because
 * the guard's absence looks exactly like the guard not being reached.
 */
export function rateLimitCheck(disabled: string | undefined): Check {
  return disabled === "true"
    ? {
        detail:
          "BETTER_AUTH_RATE_LIMIT_DISABLED is true, so the auth endpoints accept unlimited attempts from one address.",
        fix: "Clear BETTER_AUTH_RATE_LIMIT_DISABLED in apps/web/.env. Only the browser suite's own servers may set it, and playwright.config.ts does that per process.",
        name: "Auth rate limit",
        status: "failure",
      }
    : {
        detail:
          "Better Auth limits attempts per address on the auth endpoints, in production.",
        name: "Auth rate limit",
        status: "ok",
      };
}

function checkRateLimit(root: string): Check {
  const values = webEnvValues(root);
  return rateLimitCheck(values?.get("BETTER_AUTH_RATE_LIMIT_DISABLED"));
}

/**
 * The dev mailbox writes every message to `.mail/` and logs its text, which
 * carries the verification and password-reset URLs. It is confined to
 * non-production for that reason, and this variable is the one way back in — so
 * a checkout carrying it is a checkout that would leak tokens the moment it
 * served a production build. A failure rather than a warning, for the same
 * reason as the rate-limit hatch: nothing else would ever mention it.
 */
export function devMailboxCheck(enabled: string | undefined): Check {
  return enabled === "true"
    ? {
        detail:
          "EMAIL_DEV_MAILBOX_ENABLED is true, so a production build would still write action links to .mail/ and the log.",
        fix: "Clear EMAIL_DEV_MAILBOX_ENABLED in apps/web/.env. Only the browser suite's own servers may set it, and playwright.config.ts does that per process.",
        name: "Dev mailbox",
        status: "failure",
      }
    : {
        detail:
          "The dev mailbox is limited to development, where no real address receives mail.",
        name: "Dev mailbox",
        status: "ok",
      };
}

function checkDevMailbox(root: string): Check {
  const values = webEnvValues(root);
  return devMailboxCheck(values?.get("EMAIL_DEV_MAILBOX_ENABLED"));
}

function checkSocialSignIn(root: string): Check {
  const values = webEnvValues(root);
  return values === undefined
    ? {
        detail: `${webEnvPath} is missing, so no OAuth credentials can be read.`,
        fix: "Run `pnpm bootstrap`, which creates it from apps/web/.env.example.",
        name: "Social sign-in",
        status: "warning",
      }
    : socialSignInCheck(Object.fromEntries(values));
}

function checkErrorReporting(root: string): Check {
  const values = webEnvValues(root);
  return values === undefined
    ? {
        detail: `${webEnvPath} is missing, so error reporting cannot be configured.`,
        fix: "Run `pnpm bootstrap`, which creates it from apps/web/.env.example.",
        name: "Error reporting",
        status: "warning",
      }
    : errorReportingCheck(
        values.get("NEXT_PUBLIC_SENTRY_DSN"),
        Object.fromEntries(values),
      );
}

/** The web env file's values, or undefined when the file is not there yet. */
function webEnvValues(root: string): Map<string, string> | undefined {
  const absolute = path.join(root, webEnvPath);
  return existsSync(absolute)
    ? parseEnvFile(readFileSync(absolute, "utf8"))
    : undefined;
}

function checkChat(root: string): Check {
  const absolute = path.join(root, webEnvPath);
  if (!existsSync(absolute)) {
    return {
      detail: `${webEnvPath} is missing, so the chat model cannot be configured.`,
      fix: "Run `pnpm bootstrap`, which creates it from apps/web/.env.example.",
      name: "LLM chat",
      status: "warning",
    };
  }

  const values = parseEnvFile(readFileSync(absolute, "utf8"));
  return chatCheck(
    values.get("ANTHROPIC_API_KEY"),
    values.get("AI_CHAT_MODEL"),
  );
}

function checkEmail(root: string): Check {
  const absolute = path.join(root, webEnvPath);
  if (!existsSync(absolute)) {
    return {
      detail: `${webEnvPath} is missing, so transactional email cannot be configured.`,
      fix: "Run `pnpm bootstrap`, which creates it from apps/web/.env.example.",
      name: "Transactional email",
      status: "warning",
    };
  }

  const values = parseEnvFile(readFileSync(absolute, "utf8"));
  return emailCheck(values.get("RESEND_API_KEY"), values.get("EMAIL_FROM"));
}

async function checkPostgres(databaseUrl: string | undefined): Promise<Check> {
  if (databaseUrl === undefined) {
    return {
      detail: "Skipped because DATABASE_URL could not be read.",
      fix: "Resolve the web environment check first.",
      name: "PostgreSQL",
      status: "warning",
    };
  }

  const connection = parseDatabaseUrl(databaseUrl);
  const reachable = await isPortAccepting(
    connection.host,
    connection.port,
    2000,
  );

  return reachable
    ? {
        detail: `${connection.host}:${connection.port} is accepting connections.`,
        name: "PostgreSQL",
        status: "ok",
      }
    : {
        detail: `Nothing is listening on ${connection.host}:${connection.port} for database "${connection.database}".`,
        fix: "Run `pnpm bootstrap`, which starts the local PostgreSQL container and applies migrations.",
        name: "PostgreSQL",
        status: "failure",
      };
}

function checkGeneratedClient(root: string): Check {
  const generated = path.join(root, generatedClientPath);
  const schema = path.join(root, prismaSchemaPath);

  if (!existsSync(generated)) {
    return {
      detail: "The Prisma client has not been generated.",
      fix: "Run `pnpm db:generate`.",
      name: "Generated Prisma client",
      status: "failure",
    };
  }

  if (
    existsSync(schema) &&
    statSync(schema).mtimeMs > statSync(generated).mtimeMs
  ) {
    return {
      detail: `${prismaSchemaPath} is newer than the generated client.`,
      fix: "Run `pnpm db:generate`.",
      name: "Generated Prisma client",
      status: "failure",
    };
  }

  return {
    detail: "The generated Prisma client is present and current.",
    name: "Generated Prisma client",
    status: "ok",
  };
}
