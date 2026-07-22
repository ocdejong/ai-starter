import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import {
  checkCommand,
  renderPointer,
  rootContractPath,
  scopedInstructions,
  vendorPointers,
  writeCommand,
} from "./instruction-surfaces.ts";

export type PolicyViolation = {
  /** Repository-relative file the reader has to open to fix this. */
  readonly file: string;
  readonly problem: string;
  /** The exact next edit or command that resolves it. */
  readonly fix: string;
};

/**
 * Prose files that are allowed to explain the rules at length. They are checked
 * for unresolvable references only: elaborating on what `AGENTS.md` routes to is
 * their job, so the duplication rule does not apply to them.
 */
const referenceDocuments = [
  "README.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  ".github/pull_request_template.md",
];

/** Short lines collide by accident; a duplicated rule is a sentence, not a phrase. */
const minimumRuleLength = 40;

const checkableExtensions = new Set([
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mdc",
  ".mjs",
  ".prisma",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

const markdownLinkPattern = /\[[^\]\n]*\]\(([^)\s]+)\)/g;
const importPattern = /(?:^|\s)@((?:\.{0,2}\/)?[\w.][\w./-]*\.\w+)/g;
const inlineCodePattern = /`([^`\n]+)`/g;

/**
 * Every instruction and documentation surface, in report order. The list is
 * explicit rather than crawled: a crawl descends into nested checkouts and
 * generated directories, where a second `AGENTS.md` is a copy rather than a
 * competing contract.
 */
export function instructionSurfaces(): string[] {
  return [
    rootContractPath,
    ...scopedInstructions.map((scoped) => scoped.path),
    ...vendorPointers.map((pointer) => pointer.path),
  ];
}

function documentedFiles(root: string): string[] {
  const docsDirectory = path.join(root, "docs");
  const docs = existsSync(docsDirectory)
    ? readdirSync(docsDirectory)
        .filter((entry) => entry.endsWith(".md"))
        .sort()
        .map((entry) => `docs/${entry}`)
    : [];

  return [
    ...instructionSurfaces(),
    ...docs,
    ...referenceDocuments.filter((file) => existsSync(path.join(root, file))),
  ];
}

function read(root: string, file: string): string | undefined {
  const absolute = path.join(root, file);
  return existsSync(absolute) ? readFileSync(absolute, "utf8") : undefined;
}

/** Strips front matter, HTML comments and fenced code so only prose is compared. */
function prose(markdown: string): string {
  return markdown
    .replace(/^---\n[\s\S]*?\n---\n/, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/```[\s\S]*?```/g, "");
}

/**
 * The rule statements a file asserts, keyed by a normalised fingerprint so that
 * re-wrapping or re-punctuating a copied rule still counts as a copy.
 */
export function ruleStatements(markdown: string): Map<string, string> {
  const statements = new Map<string, string>();

  for (const line of prose(markdown).split("\n")) {
    const body = line.replace(/^\s*(?:[-*+]|\d+\.)\s+/, "").trim();
    if (body.startsWith("#") || body.startsWith(">") || body.startsWith("|")) {
      continue;
    }

    for (const sentence of body.split(/(?<=[.!?])\s+/)) {
      const fingerprint = sentence
        .toLowerCase()
        .replace(/[`*_]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

      if (fingerprint.length >= minimumRuleLength) {
        statements.set(fingerprint, sentence.trim());
      }
    }
  }

  return statements;
}

/** Repository-relative references a file makes to other files in the repository. */
export function references(markdown: string): string[] {
  const found = new Set<string>();
  const content = prose(markdown);

  for (const [, target] of content.matchAll(markdownLinkPattern)) {
    if (
      target === undefined ||
      /^[a-z]+:/i.test(target) ||
      target.startsWith("#")
    ) {
      continue;
    }
    const [file] = target.split("#");
    if (file !== undefined && file.length > 0) {
      found.add(file);
    }
  }

  for (const [, target] of markdown.matchAll(importPattern)) {
    if (target !== undefined) {
      found.add(target);
    }
  }

  for (const [, token] of content.matchAll(inlineCodePattern)) {
    if (token !== undefined && checkableExtensions.has(path.extname(token))) {
      found.add(token);
    }
  }

  return [...found].sort();
}

/**
 * References are written both ways in practice — repository-relative in the
 * root contract, sibling-relative inside `docs` — so either resolution counts.
 */
function resolves(root: string, file: string, reference: string): boolean {
  const candidates = [
    path.join(root, path.dirname(file), reference),
    path.join(root, reference),
  ];

  return candidates.some((candidate) => existsSync(candidate));
}

function checkPointers(root: string): PolicyViolation[] {
  const violations: PolicyViolation[] = [];

  for (const pointer of vendorPointers) {
    const expected = renderPointer(pointer);
    const actual = read(root, pointer.path);

    if (actual === undefined) {
      violations.push({
        file: pointer.path,
        fix: `Run \`${writeCommand}\`.`,
        problem: `${pointer.vendor} ${pointer.discovery}, but the file is missing, so ${pointer.vendor} never receives the contract.`,
      });
      continue;
    }

    if (actual !== expected) {
      violations.push({
        file: pointer.path,
        fix: `Run \`${writeCommand}\`. Change the wording in packages/tooling/src/instruction-surfaces.ts, never in the generated file.`,
        problem: `The pointer is stale: it no longer matches what ${pointer.vendor}'s entry renders.`,
      });
    }
  }

  return violations;
}

function checkScoped(root: string, contract: string): PolicyViolation[] {
  const violations: PolicyViolation[] = [];

  for (const scoped of scopedInstructions) {
    if (read(root, scoped.path) === undefined) {
      violations.push({
        file: scoped.path,
        fix: `Write the file, or drop its entry from packages/tooling/src/instruction-surfaces.ts.`,
        problem: `Registered scoped instructions are missing. ${scoped.justification}`,
      });
      continue;
    }

    if (!contract.includes(scoped.path)) {
      violations.push({
        file: rootContractPath,
        fix: `Mention \`${scoped.path}\` in ${rootContractPath} so an agent reaches it from the contract.`,
        problem: `${rootContractPath} does not reference the scoped instructions at ${scoped.path}, leaving them undiscoverable.`,
      });
    }
  }

  return violations;
}

/**
 * A rule belongs to exactly one instruction surface. Vendor pointers are
 * excluded because they are generated from one statement and compared byte for
 * byte above; repeating that statement is the point of them.
 */
function checkDuplication(root: string): PolicyViolation[] {
  const violations: PolicyViolation[] = [];
  const owners = new Map<string, string>();

  for (const file of [
    rootContractPath,
    ...scopedInstructions.map((scoped) => scoped.path),
  ]) {
    const content = read(root, file);
    if (content === undefined) {
      continue;
    }

    for (const [fingerprint, sentence] of ruleStatements(content)) {
      const owner = owners.get(fingerprint);
      if (owner === undefined) {
        owners.set(fingerprint, file);
        continue;
      }

      violations.push({
        file,
        fix: `Delete the sentence here and rely on ${owner}, or narrow it to the part that genuinely differs.`,
        problem: `This rule is already stated in ${owner}: "${sentence}"`,
      });
    }
  }

  return violations;
}

function checkReferences(root: string): PolicyViolation[] {
  const violations: PolicyViolation[] = [];

  for (const file of documentedFiles(root)) {
    const content = read(root, file);
    if (content === undefined) {
      // A registered surface that does not exist is already reported, with a
      // better message, by the pointer and scoped-instruction checks.
      continue;
    }

    const directory = path.posix.dirname(file);
    const attempted =
      directory === "."
        ? "the repository root"
        : `${directory}/ or the repository root`;

    for (const reference of references(content)) {
      if (!resolves(root, file, reference)) {
        violations.push({
          file,
          fix: `Point the reference at a file that exists, or remove it.`,
          problem: `References \`${reference}\`, which does not resolve from ${attempted}.`,
        });
      }
    }
  }

  return violations;
}

/** Every way the instruction surfaces can drift, checked against one checkout. */
export function checkInstructionSurfaces(root: string): PolicyViolation[] {
  const contract = read(root, rootContractPath);

  if (contract === undefined) {
    return [
      {
        file: rootContractPath,
        fix: `Restore ${rootContractPath}; every other instruction surface points at it.`,
        problem: `The canonical contract is missing.`,
      },
    ];
  }

  return [
    ...checkPointers(root),
    ...checkScoped(root, contract),
    ...checkDuplication(root),
    ...checkReferences(root),
  ];
}

/**
 * Renders every vendor pointer and returns the paths that actually changed, so
 * the command can report the drift it repaired instead of a fixed list.
 */
export function writeVendorPointers(root: string): string[] {
  const written: string[] = [];

  for (const pointer of vendorPointers) {
    const expected = renderPointer(pointer);
    if (read(root, pointer.path) === expected) {
      continue;
    }

    const absolute = path.join(root, pointer.path);
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, expected, "utf8");
    written.push(pointer.path);
  }

  return written;
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
  const surfaces = instructionSurfaces().length;

  return violations.length === 0
    ? `instructions: ${surfaces} instruction surfaces are generated, unique and fully resolvable.`
    : `instructions: ${violations.length} problem(s) found. Fix them and run \`${checkCommand}\` again.`;
}
