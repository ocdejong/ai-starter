import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { type PolicyViolation } from "./policy-violation.ts";
import { listFiles } from "./repository-files.ts";
import { verificationSteps } from "./verification.ts";

export type { PolicyViolation } from "./policy-violation.ts";

/**
 * The structural facts the module graph cannot see: which workspace packages a
 * package may depend on, whether its public surface hides its internals, whether
 * every tsconfig keeps the strict flags, where the Prisma and auth SDKs may live,
 * that no source silences a guardrail, and that the generated client and the
 * verification scripts stay wired. `docs/architecture.md` and `AGENTS.md` are the
 * sources these encode; dependency-cruiser covers the import-graph half.
 */

/** Workspace runtime edges each package may declare. `@ai-starter/config` is a
 * build-time dependency everywhere and is checked separately, never here. */
const allowedWorkspaceDependencies: Readonly<
  Record<string, readonly string[]>
> = {
  "@ai-starter/api": ["@ai-starter/domain"],
  "@ai-starter/auth": ["@ai-starter/db"],
  "@ai-starter/config": [],
  "@ai-starter/db": [],
  "@ai-starter/domain": [],
  "@ai-starter/email": ["@ai-starter/api"],
  "@ai-starter/i18n": [],
  "@ai-starter/mobile": [
    "@ai-starter/api",
    "@ai-starter/domain",
    "@ai-starter/i18n",
    "@ai-starter/tokens",
  ],
  "@ai-starter/tokens": [],
  "@ai-starter/tooling": [],
  "@ai-starter/web": [
    "@ai-starter/api",
    "@ai-starter/auth",
    "@ai-starter/db",
    "@ai-starter/domain",
    "@ai-starter/email",
    "@ai-starter/i18n",
    "@ai-starter/tokens",
  ],
};

/** Packages whose internals must stay unreachable behind a curated exports map. */
const libraryPackages = [
  "@ai-starter/api",
  "@ai-starter/auth",
  "@ai-starter/db",
  "@ai-starter/domain",
  "@ai-starter/email",
  "@ai-starter/i18n",
  "@ai-starter/tokens",
];

/** Vendor SDKs that belong to one layer only, keyed to the packages allowed to hold them. */
const vendorSdkLocations: Readonly<Record<string, readonly string[]>> = {
  // The provider SDK stays where the model is chosen: apps/web's composition
  // root. The client half — the hook and the transport — belongs to both chat
  // screens, because a native app cannot reach the server's route handler
  // through anything else.
  "@ai-sdk/anthropic": ["@ai-starter/web"],
  "@ai-sdk/react": ["@ai-starter/mobile", "@ai-starter/web"],
  "@prisma/client": ["@ai-starter/db"],
  "@prisma/engines": ["@ai-starter/db"],
  // The auth factory owns the server SDK; apps/web keeps the React client and
  // the Next.js handler adapter, and apps/mobile keeps the React client plus the
  // Expo storage plugin — the SDK legitimately lives in all three, because the
  // client half cannot be reached through the server-only auth package.
  "better-auth": ["@ai-starter/auth", "@ai-starter/mobile", "@ai-starter/web"],
  ai: ["@ai-starter/mobile", "@ai-starter/web"],
  prisma: ["@ai-starter/db"],
  resend: ["@ai-starter/email"],
};

const requiredCompilerFlags = [
  "strict",
  "noUncheckedIndexedAccess",
  "exactOptionalPropertyTypes",
];

const requiredPackageScripts = ["lint", "typecheck"];

const strictBaseTsconfig = "packages/config/typescript/base.json";
const generatedClientIgnore = "packages/db/generated";
const configPackage = "@ai-starter/config";

type Manifest = {
  readonly name: string;
  /** Repository-relative directory, "" for the root package. */
  readonly directory: string;
  readonly manifestPath: string;
  readonly json: Record<string, unknown>;
};

function readText(root: string, file: string): string | undefined {
  const absolute = path.join(root, file);
  return existsSync(absolute) ? readFileSync(absolute, "utf8") : undefined;
}

function readJson(
  root: string,
  file: string,
): Record<string, unknown> | undefined {
  const text = readText(root, file);
  if (text === undefined) {
    return undefined;
  }
  const parsed: unknown = JSON.parse(text);
  return typeof parsed === "object" && parsed !== null
    ? (parsed as Record<string, unknown>)
    : undefined;
}

/** The globbed workspace directories, read from `pnpm-workspace.yaml` itself. */
export function workspaceDirectories(root: string): string[] {
  const text = readText(root, "pnpm-workspace.yaml") ?? "";
  const directories: string[] = [];

  for (const line of text.split("\n")) {
    const match = /^\s*-\s*["']?([^"'\s]+)["']?\s*$/.exec(line);
    const glob = match?.[1];
    if (!glob?.endsWith("/*")) {
      continue;
    }
    const parent = glob.slice(0, -2);
    const absolute = path.join(root, parent);
    if (!existsSync(absolute)) {
      continue;
    }
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        directories.push(`${parent}/${entry.name}`);
      }
    }
  }

  return directories.sort();
}

/** Every package manifest, root first, keyed by the name it declares. */
function manifests(root: string): Manifest[] {
  const found: Manifest[] = [];

  for (const directory of ["", ...workspaceDirectories(root)]) {
    const manifestPath = path.posix.join(directory, "package.json");
    const json = readJson(root, manifestPath);
    if (json === undefined) {
      continue;
    }
    found.push({
      directory,
      json,
      manifestPath,
      name: typeof json.name === "string" ? json.name : manifestPath,
    });
  }

  return found;
}

function dependencyNames(json: Record<string, unknown>): string[] {
  const names = new Set<string>();
  for (const field of ["dependencies", "devDependencies"] as const) {
    const group = json[field];
    if (typeof group === "object" && group !== null) {
      for (const name of Object.keys(group)) {
        names.add(name);
      }
    }
  }
  return [...names];
}

function scriptNames(json: Record<string, unknown>): Set<string> {
  const scripts = json.scripts;
  return new Set(
    typeof scripts === "object" && scripts !== null ? Object.keys(scripts) : [],
  );
}

function checkWorkspaceDependencies(
  all: readonly Manifest[],
): PolicyViolation[] {
  const violations: PolicyViolation[] = [];

  for (const manifest of all) {
    if (manifest.directory === "") {
      continue;
    }
    const allowed = allowedWorkspaceDependencies[manifest.name];
    if (allowed === undefined) {
      violations.push({
        file: manifest.manifestPath,
        fix: `Register ${manifest.name} in allowedWorkspaceDependencies in packages/tooling/src/repository-policy.ts.`,
        problem: `${manifest.name} is not a known workspace package, so its allowed dependencies are undefined.`,
      });
      continue;
    }

    for (const dependency of dependencyNames(manifest.json)) {
      if (
        !dependency.startsWith("@ai-starter/") ||
        dependency === configPackage ||
        allowed.includes(dependency)
      ) {
        continue;
      }
      violations.push({
        file: manifest.manifestPath,
        fix: `Remove ${dependency}, or route the need through one of: ${allowed.join(", ") || "no workspace packages"}.`,
        problem: `${manifest.name} depends on ${dependency}, which its layer may not import.`,
      });
    }
  }

  return violations;
}

function exportTargets(exportsField: unknown): string[] {
  if (typeof exportsField === "string") {
    return [exportsField];
  }
  if (typeof exportsField !== "object" || exportsField === null) {
    return [];
  }
  return Object.values(exportsField as Record<string, unknown>).flatMap(
    (value) => exportTargets(value),
  );
}

function checkPublicExports(all: readonly Manifest[]): PolicyViolation[] {
  const byName = new Map(all.map((manifest) => [manifest.name, manifest]));
  const violations: PolicyViolation[] = [];

  for (const name of libraryPackages) {
    const manifest = byName.get(name);
    if (manifest === undefined) {
      continue;
    }
    const exportsField = manifest.json.exports;
    if (typeof exportsField !== "object" || exportsField === null) {
      violations.push({
        file: manifest.manifestPath,
        fix: `Add an "exports" map naming the public entry points; without it the whole package resolves.`,
        problem: `${name} declares no exports map, so consumers can reach its internals.`,
      });
      continue;
    }

    const keys = Object.keys(exportsField);
    const wildcard = [...keys, ...exportTargets(exportsField)].find((entry) =>
      entry.includes("*"),
    );
    if (wildcard !== undefined) {
      violations.push({
        file: manifest.manifestPath,
        fix: `Replace the "${wildcard}" wildcard with explicit subpath exports so internals stay private.`,
        problem: `${name} exposes internals through a wildcard export ("${wildcard}").`,
      });
    }
  }

  return violations;
}

/** Merges compilerOptions along the `extends` chain, later entries winning. */
function resolveTsconfig(
  root: string,
  file: string,
  visited: Set<string>,
  options: Record<string, unknown>,
): void {
  if (visited.has(file)) {
    return;
  }
  visited.add(file);

  const json = readJson(root, file);
  if (json === undefined) {
    return;
  }

  const extendsField = json.extends;
  const parents =
    typeof extendsField === "string"
      ? [extendsField]
      : Array.isArray(extendsField)
        ? extendsField.filter(
            (entry): entry is string => typeof entry === "string",
          )
        : [];

  for (const parent of parents) {
    const resolved = resolveExtends(file, parent);
    if (resolved !== undefined) {
      resolveTsconfig(root, resolved, visited, options);
    }
  }

  const own = json.compilerOptions;
  if (typeof own === "object" && own !== null) {
    Object.assign(options, own);
  }
}

/** Resolves the extends targets this repository writes; leaves external ones opaque. */
function resolveExtends(from: string, target: string): string | undefined {
  if (target.startsWith(".") || target.startsWith("/")) {
    return path.posix.normalize(
      path.posix.join(path.posix.dirname(from), target),
    );
  }
  const configPrefix = "@ai-starter/config/";
  if (target.startsWith(configPrefix)) {
    return `packages/config/${target.slice(configPrefix.length)}`;
  }
  return undefined;
}

function checkCompilerFlags(
  root: string,
  all: readonly Manifest[],
): PolicyViolation[] {
  const violations: PolicyViolation[] = [];

  for (const manifest of all) {
    if (manifest.directory === "") {
      continue;
    }
    const tsconfig = path.posix.join(manifest.directory, "tsconfig.json");
    if (readText(root, tsconfig) === undefined) {
      continue;
    }

    const visited = new Set<string>();
    const options: Record<string, unknown> = {};
    resolveTsconfig(root, tsconfig, visited, options);

    if (!visited.has(strictBaseTsconfig)) {
      violations.push({
        file: tsconfig,
        fix: `Extend "${configPackage}/typescript/base.json" so the strict flags apply.`,
        problem: `${tsconfig} does not extend the shared strict base, so its compiler flags are unpinned.`,
      });
      continue;
    }

    for (const flag of requiredCompilerFlags) {
      if (options[flag] !== true) {
        violations.push({
          file: tsconfig,
          fix: `Remove the override so "${flag}" stays true, inherited from the shared base.`,
          problem: `${tsconfig} does not keep "${flag}" enabled.`,
        });
      }
    }
  }

  return violations;
}

function checkVendorSdkLocations(all: readonly Manifest[]): PolicyViolation[] {
  const violations: PolicyViolation[] = [];

  for (const manifest of all) {
    const dependencies = new Set(dependencyNames(manifest.json));
    for (const [sdk, allowed] of Object.entries(vendorSdkLocations)) {
      if (dependencies.has(sdk) && !allowed.includes(manifest.name)) {
        violations.push({
          file: manifest.manifestPath,
          fix: `Move ${sdk} behind an adapter in ${allowed.join(", ")}; keep it out of ${manifest.name}.`,
          problem: `${manifest.name} depends on ${sdk}, which only ${allowed.join(", ")} may hold.`,
        });
      }
    }
  }

  return violations;
}

const tsExtensions = new Set([".ts", ".tsx"]);

/** A bypass only takes effect in a comment, so string mentions of a directive are inert. */
const commentedTsDirective =
  /(?:\/\/|\/\*|^\s*\*)\s*@ts-(ignore|nocheck|expect-error)\b[ \t]*(.*)$/;
const commentedEslintDisable =
  /(?:\/\/|\/\*)\s*(eslint-disable(?:-next-line|-line)?)\b(.*)$/;

function checkForbiddenBypasses(root: string): PolicyViolation[] {
  const violations: PolicyViolation[] = [];

  const sources = listFiles(root).filter(
    (file) =>
      /^(apps|packages)\/[^/]+\/src\//.test(file) &&
      tsExtensions.has(path.extname(file)) &&
      !/\.test\.tsx?$/.test(file),
  );

  for (const file of sources) {
    const text = readText(root, file);
    if (text === undefined) {
      continue;
    }

    text.split("\n").forEach((line, index) => {
      const location = `${file}:${index + 1}`;

      const ts = commentedTsDirective.exec(line);
      if (ts !== null) {
        const kind = ts[1];
        const trailing = (ts[2] ?? "").trim();
        if (kind === "ignore" || kind === "nocheck") {
          violations.push({
            file: location,
            fix: `Fix the underlying type error instead of suppressing it with @ts-${kind}.`,
            problem: `@ts-${kind} silences the type checker.`,
          });
        } else if (trailing.length === 0) {
          violations.push({
            file: location,
            fix: `Add a description after @ts-expect-error explaining why the error is expected.`,
            problem: `@ts-expect-error carries no explanation.`,
          });
        }
      }

      const eslint = commentedEslintDisable.exec(line);
      if (eslint !== null) {
        const trailing = eslint[2] ?? "";
        const justification = trailing.split("--")[1]?.trim() ?? "";
        if (justification.length === 0) {
          violations.push({
            file: location,
            fix: `Justify the disable with " -- reason", or fix the code so the rule passes.`,
            problem: `${eslint[1]} silences a lint rule without a justification.`,
          });
        }
      }
    });
  }

  return violations;
}

function checkGeneratedCleanliness(root: string): PolicyViolation[] {
  const gitignore = readText(root, ".gitignore");
  const ignored = (gitignore ?? "")
    .split("\n")
    .map((line) => line.trim().replace(/^\/+/, "").replace(/\/+$/, ""))
    .includes(generatedClientIgnore);

  if (ignored) {
    return [];
  }

  return [
    {
      file: ".gitignore",
      fix: `Add "/${generatedClientIgnore}/" so the generated Prisma client is never committed.`,
      problem: `The generated Prisma client at ${generatedClientIgnore}/ is not gitignored.`,
    },
  ];
}

function checkRequiredScripts(all: readonly Manifest[]): PolicyViolation[] {
  const violations: PolicyViolation[] = [];
  const root = all.find((manifest) => manifest.directory === "");

  if (root !== undefined) {
    const scripts = scriptNames(root.json);
    for (const step of verificationSteps) {
      if (!scripts.has(step.name)) {
        violations.push({
          file: "package.json",
          fix: `Add a "${step.name}" script; the verification suite runs \`pnpm run ${step.name}\`.`,
          problem: `The root manifest has no "${step.name}" script, so \`pnpm verify\` cannot run that step.`,
        });
      }
    }
  }

  for (const manifest of all) {
    if (manifest.directory === "") {
      continue;
    }
    const scripts = scriptNames(manifest.json);
    for (const required of requiredPackageScripts) {
      if (!scripts.has(required)) {
        violations.push({
          file: manifest.manifestPath,
          fix: `Add a "${required}" script so \`turbo run ${required}\` reaches ${manifest.name}.`,
          problem: `${manifest.name} defines no "${required}" script.`,
        });
      }
    }
  }

  return violations;
}

/**
 * Error reporting stays off without a DSN, and never sends personal data.
 *
 * Both are rules `AGENTS.md` states and nothing enforced: four `Sentry.init`
 * call sites, no test, and a default — `sendDefaultPii` — whose absence reads
 * exactly like its presence. The options object is read as text because that is
 * what a reviewer reads, and because these files run before anything a test
 * could import them into.
 */
function checkErrorReporting(root: string): PolicyViolation[] {
  const sources = listFiles(root).filter(
    (file) =>
      /^(apps|packages)\//.test(file) &&
      // This package may import no installed dependency, so it can never
      // initialize an SDK — and its own source carries the call this looks for.
      !file.startsWith("packages/tooling/") &&
      tsExtensions.has(path.extname(file)) &&
      !/\.test\.tsx?$/.test(file),
  );

  return sources.flatMap((file) => {
    const text = readText(root, file);
    const options = text === undefined ? undefined : sentryInitOptions(text);
    if (options === undefined) {
      return [];
    }

    const violations: PolicyViolation[] = [];
    const pii = options.get("sendDefaultPii");
    const enabled = options.get("enabled");

    if (pii !== "false") {
      violations.push({
        file,
        fix: "Pass `sendDefaultPii: false` to Sentry.init, or record the privacy decision that changes it.",
        problem:
          pii === undefined
            ? "Sentry.init does not set sendDefaultPii, so the SDK's own default decides whether personal data is sent."
            : `Sentry.init sets sendDefaultPii to ${pii}.`,
      });
    }

    if (enabled === undefined || !/dsn/i.test(enabled)) {
      violations.push({
        file,
        fix: "Gate `enabled` on the DSN, so a deployment that configured none reports nothing.",
        problem:
          enabled === undefined
            ? "Sentry.init has no `enabled` gate, so it initializes whether or not a DSN is configured."
            : "Sentry.init's `enabled` gate does not depend on the DSN.",
      });
    }

    return violations;
  });
}

/**
 * The keys of the object literal passed to `Sentry.init`, mapped to their value
 * text. Depth counting is enough here: the options are a literal by convention,
 * and a call this cannot read reports as having no options at all — which fails,
 * rather than passing quietly.
 */
function sentryInitOptions(text: string): Map<string, string> | undefined {
  const start = text.indexOf("Sentry.init({");
  if (start === -1) {
    return undefined;
  }

  const bodyStart = text.indexOf("{", start) + 1;
  let depth = 1;
  let index = bodyStart;
  while (index < text.length && depth > 0) {
    const character = text[index];
    if (character === "{" || character === "(" || character === "[") {
      depth += 1;
    } else if (character === "}" || character === ")" || character === "]") {
      depth -= 1;
    }
    index += 1;
  }

  const options = new Map<string, string>();
  for (const entry of splitTopLevel(text.slice(bodyStart, index - 1))) {
    const separator = entry.indexOf(":");
    if (separator === -1) {
      continue;
    }
    options.set(
      entry.slice(0, separator).trim(),
      entry.slice(separator + 1).trim(),
    );
  }

  return options;
}

/** Splits an object body on the commas that separate its own entries. */
function splitTopLevel(body: string): string[] {
  const entries: string[] = [];
  let depth = 0;
  let current = "";

  for (const character of body) {
    if (character === "{" || character === "(" || character === "[") {
      depth += 1;
    } else if (character === "}" || character === ")" || character === "]") {
      depth -= 1;
    }

    if (character === "," && depth === 0) {
      entries.push(current);
      current = "";
      continue;
    }
    current += character;
  }

  entries.push(current);
  return entries.filter((entry) => entry.trim() !== "");
}

/**
 * Every environment variable an app declares has to be in the build task's
 * environment, or Turborepo can serve a cached build made under a different
 * value. The failure is silent by construction — the build is *correct*, just
 * for yesterday's configuration — and it is what let the two Google OAuth
 * variables sit outside the hash from the stage that introduced them.
 *
 * The app's own `env` module is the source: it names what the app reads, and
 * `process.env.X` is the one shape every entry in it takes.
 */
function checkBuildEnvironment(root: string): PolicyViolation[] {
  const declared = readJson(root, "turbo.json")?.tasks;
  const build =
    typeof declared === "object" && declared !== null
      ? (declared as Record<string, unknown>).build
      : undefined;
  const listed =
    typeof build === "object" && build !== null
      ? (build as Record<string, unknown>).env
      : undefined;

  if (!Array.isArray(listed)) {
    return [];
  }

  const patterns = listed.filter(
    (entry): entry is string => typeof entry === "string",
  );
  const covered = (name: string): boolean =>
    patterns.some((pattern) =>
      pattern.endsWith("*")
        ? name.startsWith(pattern.slice(0, -1))
        : pattern === name,
    );

  return appEnvModules(root).flatMap((file) => {
    const source = readText(root, file) ?? "";
    const names = new Set(
      [...source.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)].flatMap(
        ([, name]) => (name === undefined ? [] : [name]),
      ),
    );

    return [...names]
      .filter((name) => !covered(name))
      .sort()
      .map((name) => ({
        file: "turbo.json",
        fix: `Add "${name}" to tasks.build.env, or a prefix pattern that covers it.`,
        problem: `${file} reads ${name}, which is outside the build task's environment, so a change to it can be served a stale cached build.`,
      }));
  });
}

/** Each app's declared environment contract, `apps/<app>/src/env.{js,ts}`. */
function appEnvModules(root: string): string[] {
  const apps = path.join(root, "apps");
  if (!existsSync(apps)) {
    return [];
  }

  return readdirSync(apps, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) =>
      ["js", "ts"]
        .map((extension) => `apps/${entry.name}/src/env.${extension}`)
        .filter((file) => existsSync(path.join(root, file))),
    );
}

/** Every way the repository structure can drift, checked against one checkout. */
export function checkRepositoryPolicy(root: string): PolicyViolation[] {
  const all = manifests(root);

  return [
    ...checkWorkspaceDependencies(all),
    ...checkPublicExports(all),
    ...checkCompilerFlags(root, all),
    ...checkVendorSdkLocations(all),
    ...checkForbiddenBypasses(root),
    ...checkGeneratedCleanliness(root),
    ...checkRequiredScripts(all),
    ...checkBuildEnvironment(root),
    ...checkErrorReporting(root),
  ];
}

export function formatViolations(
  violations: readonly PolicyViolation[],
): string {
  return violations
    .map(
      (violation) =>
        `FAIL  ${violation.file}: ${violation.problem}\n        fix: ${violation.fix}`,
    )
    .join("\n");
}

export function summarise(violations: readonly PolicyViolation[]): string {
  return violations.length === 0
    ? "policy: repository structure, exports, compiler flags, SDK locations, scripts, build environment, error reporting, workflows, supply-chain settings, native flows, translated copy and the suppression ratchet are consistent."
    : `policy: ${violations.length} problem(s) found. Fix them and run \`pnpm policy\` again.`;
}
