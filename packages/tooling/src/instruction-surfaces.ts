/**
 * The single source for every agent instruction surface.
 *
 * `AGENTS.md` carries the rules. Each supported agent reads a different file,
 * so this module describes those files instead of restating the contract in
 * them: `pnpm instructions:write` renders the vendor pointers from the one
 * statement below, and `pnpm instructions` fails when a checkout no longer
 * matches. Scoped instructions are hand-written because they carry a genuine
 * per-package delta, so they are listed rather than generated.
 */

export const rootContractPath = "AGENTS.md";

export const checkCommand = "pnpm instructions";
export const writeCommand = "pnpm instructions:write";

export const sourcePath = "packages/tooling/src/instruction-surfaces.ts";

/**
 * What has to survive rendering for the vendor to load the contract at all.
 *
 * Comparing a pointer against this module proves it is not hand-edited, but a
 * template that loses its import line or its `alwaysApply` flag regenerates
 * cleanly and still matches, while the agent silently stops receiving the
 * contract. This pins each template to the vendor's requirement instead.
 */
export type LoadMarker = {
  /** Completes "would no longer …", so phrase it as an action. */
  readonly description: string;
  readonly pattern: RegExp;
};

export type VendorPointer = {
  readonly path: string;
  /** The agent that reads this file. */
  readonly vendor: string;
  /** How that agent finds the file without being told to, in one clause. */
  readonly discovery: string;
  /** Every requirement the rendered file must satisfy for the vendor to load it. */
  readonly loadMarkers: readonly LoadMarker[];
  /** Vendor-specific import line, omitted where the vendor has no import syntax. */
  readonly reference?: string;
  /** Leading YAML block, for vendors that key their loading rules off one. */
  readonly frontmatter?: readonly string[];
};

/** Every import-following vendor needs a resolvable `@` import on its own line. */
const importsTheContract: LoadMarker = {
  description: `import \`${rootContractPath}\``,
  pattern: /^@\.{0,2}\/?AGENTS\.md$/m,
};

/**
 * Every file a supported agent loads on its own. Each entry exists so the
 * agent reaches `AGENTS.md` without the human pasting instructions; only the
 * discovery mechanism differs between them.
 */
export const vendorPointers: readonly VendorPointer[] = [
  {
    discovery:
      "reads `CLAUDE.md` from the repository root and follows `@` imports",
    loadMarkers: [importsTheContract],
    path: "CLAUDE.md",
    reference: "@AGENTS.md",
    vendor: "Claude Code",
  },
  {
    discovery:
      "reads `GEMINI.md` from the repository root and follows `@` imports",
    loadMarkers: [importsTheContract],
    path: "GEMINI.md",
    reference: "@./AGENTS.md",
    vendor: "Gemini CLI",
  },
  {
    discovery:
      "applies every `.cursor/rules/*.mdc` file whose front matter sets `alwaysApply: true`",
    frontmatter: [
      "description: Binding repository contract for every change",
      "alwaysApply: true",
    ],
    loadMarkers: [
      {
        description: "declare `alwaysApply: true` in its front matter",
        pattern: /^alwaysApply: true$/m,
      },
      importsTheContract,
    ],
    path: ".cursor/rules/repository.mdc",
    reference: "@AGENTS.md",
    vendor: "Cursor",
  },
  {
    discovery:
      "reads `.github/copilot-instructions.md` for every request in the repository",
    loadMarkers: [
      {
        // Copilot has no import syntax: the prose naming the file is the pointer.
        description: `name \`${rootContractPath}\``,
        pattern: /`AGENTS\.md`/,
      },
    ],
    path: ".github/copilot-instructions.md",
    vendor: "GitHub Copilot",
  },
];

export type ScopedInstructions = {
  readonly path: string;
  /** The genuine difference that justifies a second instruction surface. */
  readonly justification: string;
};

/**
 * Packages whose rules genuinely differ from the root contract. A package
 * belongs here only when an agent editing it needs something the root contract
 * does not already say; restating the root contract is a policy failure.
 */
export const scopedInstructions: readonly ScopedInstructions[] = [
  {
    justification:
      "Node executes this package directly, so it carries type-stripping and command-contract rules that apply nowhere else.",
    path: "packages/tooling/AGENTS.md",
  },
];

/** The one statement every pointer carries; the rules themselves stay in `AGENTS.md`. */
function pointerStatement(): string {
  return `\`${rootContractPath}\` is the binding repository contract. Read and follow it before making or reviewing changes; it routes to the canonical engineering-principle, architecture, testing and security guidance. Do not duplicate or override those rules here.`;
}

/**
 * Renders a pointer file. Front matter has to come first for the vendors that
 * parse it, so the generated banner follows it rather than heading the file.
 */
export function renderPointer(pointer: VendorPointer): string {
  const blocks: string[] = [];

  if (pointer.frontmatter !== undefined) {
    blocks.push(["---", ...pointer.frontmatter, "---"].join("\n"));
  }

  blocks.push(
    `<!-- Generated from ${sourcePath} by \`${writeCommand}\`. Edit ${rootContractPath} instead. -->`,
    `# ${pointer.vendor} instructions`,
    pointerStatement(),
  );

  if (pointer.reference !== undefined) {
    blocks.push(pointer.reference);
  }

  return `${blocks.join("\n\n")}\n`;
}
