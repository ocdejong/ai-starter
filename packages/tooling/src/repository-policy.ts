import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { listFiles } from "./repository-files.ts";
import { verificationSteps } from "./verification.ts";

export type PolicyViolation = {
  /** Repository-relative file the reader has to open to fix this. */
  readonly file: string;
  readonly problem: string;
  /** The exact next edit that resolves it. */
  readonly fix: string;
};

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
  "@ai-starter/config": [],
  "@ai-starter/db": [],
  "@ai-starter/domain": [],
  "@ai-starter/email": ["@ai-starter/api"],
  "@ai-starter/mobile": ["@ai-starter/api", "@ai-starter/tokens"],
  "@ai-starter/tokens": [],
  "@ai-starter/tooling": [],
  "@ai-starter/web": [
    "@ai-starter/api",
    "@ai-starter/db",
    "@ai-starter/email",
    "@ai-starter/tokens",
  ],
};

/** Packages whose internals must stay unreachable behind a curated exports map. */
const libraryPackages = [
  "@ai-starter/api",
  "@ai-starter/db",
  "@ai-starter/domain",
  "@ai-starter/email",
  "@ai-starter/tokens",
];

/** Vendor SDKs that belong to one layer only, keyed to the packages allowed to hold them. */
const vendorSdkLocations: Readonly<Record<string, readonly string[]>> = {
  "@prisma/client": ["@ai-starter/db"],
  "@prisma/engines": ["@ai-starter/db"],
  "better-auth": ["@ai-starter/web"],
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
function workspaceDirectories(root: string): string[] {
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
    ? "policy: repository structure, exports, compiler flags, SDK locations and scripts are consistent."
    : `policy: ${violations.length} problem(s) found. Fix them and run \`pnpm policy\` again.`;
}
