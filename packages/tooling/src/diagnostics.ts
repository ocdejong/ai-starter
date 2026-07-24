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

export type CheckStatus = "ok" | "warning" | "failure";

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
  checks.push(checkChat(root));
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
      detail: `${webEnvPath} defines DATABASE_URL and BETTER_AUTH_SECRET.`,
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
