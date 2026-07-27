import { existsSync, writeFileSync } from "node:fs";
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

type ResidualIdentity = {
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
function findResidualIdentity(
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

export type ReadmeHandover = {
  readonly changed: boolean;
  readonly message: string;
};

/** The section that exists only for a reader who has not run this command yet. */
const instantiationHeading = "## Create a product from this template";

/**
 * Gives the product a README addressed to its owner rather than to the person
 * about to instantiate it.
 *
 * The identity rewrite reaches every starter *identifier* in this file and none
 * of its framing, so without this step a new product's front door still carries
 * the template's title and a section telling its reader to run the command they
 * have just run. Everything else — starting locally, adding a feature, verifying
 * — is as true of the product as it was of the template, so it stays.
 */
export function handOverReadme(
  root: string,
  product: Identity,
): ReadmeHandover {
  const file = path.join(root, "README.md");
  const content = existsSync(file) ? readTextFile(file) : undefined;

  if (content === undefined) {
    return { changed: false, message: "No README.md to hand over." };
  }

  const retitled = content.replace(/^# .*$/m, `# ${product.displayName}`);
  const start = retitled.indexOf(instantiationHeading);
  const rest =
    start === -1
      ? retitled
      : `${retitled.slice(0, start)}${nextSection(retitled, start)}`;

  if (rest === content) {
    return {
      changed: false,
      message: "README.md already addresses the product.",
    };
  }

  writeFileSync(file, rest);

  return {
    changed: true,
    message: `Retitled README.md and removed "${instantiationHeading.slice(3)}".`,
  };
}

/** Everything from the heading after `start`, or nothing when it was the last. */
function nextSection(markdown: string, start: number): string {
  const following = markdown.indexOf(
    "\n## ",
    start + instantiationHeading.length,
  );

  return following === -1 ? "" : markdown.slice(following + 1);
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
