import { writeFileSync } from "node:fs";
import path from "node:path";

import { runCapture, runInherit } from "./command.ts";
import {
  isRewritableTextFile,
  listFiles,
  readTextFile,
} from "./repository-files.ts";
import { identityTokens } from "./product-identity.ts";
import {
  applyReplacements,
  buildIdentityReplacements,
  findOccurrences,
  type Occurrence,
} from "./text-replacement.ts";
import {
  type Identity,
  starterIdentityModulePath,
} from "./starter-identity.ts";

export type ResidualIdentity = {
  readonly file: string;
  /** Empty when the identity is in the file's name rather than its content. */
  readonly occurrences: readonly Occurrence[];
  readonly inPath: boolean;
};

export type InitializationResult = {
  readonly matchedFiles: number;
  readonly changedFiles: readonly string[];
  readonly residual: readonly ResidualIdentity[];
};

/**
 * Rewrites every starter identifier in place and then proves none survived.
 *
 * `starter-identity.ts` is excluded from both passes on purpose: it is the
 * canonical record of what the starter was called, so a downstream repository
 * keeps a correct definition and the scan keeps a fixed reference point.
 */
export function initializeStarter(
  root: string,
  starter: Identity,
  product: Identity,
): InitializationResult {
  const replacements = buildIdentityReplacements(starter, product);
  const tokens = identityTokens(starter);

  const changedFiles: string[] = [];
  let matchedFiles = 0;

  for (const file of listFiles(root)) {
    if (file === starterIdentityModulePath || !isRewritableTextFile(file)) {
      continue;
    }

    const absolute = path.join(root, file);
    const content = readTextFile(absolute);
    if (content === undefined) {
      continue;
    }

    if (findOccurrences(content, tokens).length > 0) {
      matchedFiles += 1;
    }

    const rewritten = applyReplacements(content, replacements);
    if (rewritten !== content) {
      writeFileSync(absolute, rewritten);
      changedFiles.push(file);
    }
  }

  return {
    changedFiles,
    matchedFiles,
    residual: findResidualIdentity(root, starter),
  };
}

/**
 * Re-reads the repository from disk so the proof is independent of the rewrite.
 * File names are checked as well as file content: the rewrite cannot rename a
 * file, so a path that still carries the starter identity has to be reported
 * rather than silently accepted.
 */
export function findResidualIdentity(
  root: string,
  starter: Identity,
): ResidualIdentity[] {
  const tokens = identityTokens(starter);
  const residual: ResidualIdentity[] = [];

  for (const file of listFiles(root)) {
    if (file === starterIdentityModulePath) {
      continue;
    }

    const inPath = findOccurrences(file, tokens).length > 0;
    const content = isRewritableTextFile(file)
      ? readTextFile(path.join(root, file))
      : undefined;
    const occurrences =
      content === undefined ? [] : findOccurrences(content, tokens);

    if (inPath || occurrences.length > 0) {
      residual.push({ file, inPath, occurrences });
    }
  }

  return residual;
}

export type FinalizationResult = {
  readonly ok: boolean;
  readonly message: string;
};

/**
 * Renaming the workspace packages invalidates the installed link tree, and the
 * new identifiers have different lengths, so Prettier wraps several files
 * differently. Both are consequences of the rewrite rather than follow-up work,
 * so the initializer completes them itself and leaves a repository that passes
 * `pnpm verify`.
 */
export function finalizeInitialization(root: string): FinalizationResult {
  if (runCapture("pnpm", ["--version"], { cwd: root }).code !== 0) {
    return {
      message:
        "pnpm is not available, so the workspace was not relinked or reformatted. Run `pnpm install` and `pnpm format:write` before `pnpm verify`.",
      ok: false,
    };
  }

  if (runInherit("pnpm", ["install"], { cwd: root }) !== 0) {
    return {
      message:
        "`pnpm install` failed after the rename. Resolve the cause above, then run `pnpm install` and `pnpm format:write`.",
      ok: false,
    };
  }

  if (runInherit("pnpm", ["format:write"], { cwd: root }) !== 0) {
    return {
      message:
        "`pnpm format:write` failed after the rename. Resolve the cause above, then run it again before `pnpm verify`.",
      ok: false,
    };
  }

  return { message: "Relinked the workspace and reformatted.", ok: true };
}
