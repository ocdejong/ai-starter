import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  checkInstructionSurfaces,
  references,
  ruleStatements,
  writeVendorPointers,
  type PolicyViolation,
} from "./instruction-policy.ts";
import {
  renderPointer,
  scopedInstructions,
  vendorPointers,
} from "./instruction-surfaces.ts";
import { repositoryRoot } from "./repository.ts";

const scopedPath = scopedInstructions[0]?.path ?? "";

const contract = `# Agent contract

Read \`docs/engineering-principles.md\` before every code change, then use \`docs/README.md\` for the rest.

- Validate every untrusted runtime boundary with Zod, because TypeScript types alone are not validation.
- Editing repository tooling also requires ${scopedPath}.
`;

const scopedContract = `# Repository tooling

- Node executes these files by stripping types, so enums and parameter properties fail at runtime.
`;

const temporaryRoots: string[] = [];

/** A checkout that satisfies the policy, so each test can break exactly one thing. */
function cleanCheckout(): string {
  const root = mkdtempSync(path.join(tmpdir(), "instruction-policy-"));
  temporaryRoots.push(root);

  write(root, "AGENTS.md", contract);
  write(root, scopedPath, scopedContract);
  write(root, "docs/README.md", "# Map\n\nSee `engineering-principles.md`.\n");
  write(root, "docs/engineering-principles.md", "# Principles\n");
  writeVendorPointers(root);

  return root;
}

/** The contract's map, as its "Where code belongs" bullets render it. */
function whereCodeBelongs(packages: readonly string[]): string {
  const bullets = packages
    .map((name) => `- \`packages/${name}\`: what belongs in ${name}.`)
    .join("\n");

  return `\n## Where code belongs\n\n${bullets}\n`;
}

/** The README's map, as its indented tree renders it. */
function workspaceTree(packages: readonly string[]): string {
  const lines = packages.map((name) => `  ${name}/  what belongs in ${name}`);

  return `# Product\n\n\`\`\`text\npackages/\n${lines.join("\n")}\n\`\`\`\n`;
}

/**
 * A clean checkout that also has a workspace, mapped correctly by both surfaces.
 * The scoped-instruction package is already a directory under the glob, so it is
 * mapped too — otherwise every case would report it alongside its own subject.
 */
function workspaceCheckout(packages: readonly string[]): string {
  const root = cleanCheckout();
  const mapped = [...packages, path.basename(path.dirname(scopedPath))].sort();

  write(root, "pnpm-workspace.yaml", 'packages:\n  - "packages/*"\n');
  for (const name of packages) {
    write(root, `packages/${name}/package.json`, "{}\n");
  }
  write(root, "AGENTS.md", `${contract}${whereCodeBelongs(mapped)}`);
  write(root, "README.md", workspaceTree(mapped));

  return root;
}

function write(root: string, file: string, content: string): void {
  const absolute = path.join(root, file);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf8");
}

function problems(violations: readonly PolicyViolation[]): string {
  return violations
    .map(
      (violation) => `${violation.file}: ${violation.problem} ${violation.fix}`,
    )
    .join("\n");
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("instruction surface policy", () => {
  it("accepts a checkout whose surfaces are generated, unique and resolvable", () => {
    expect(checkInstructionSurfaces(cleanCheckout())).toEqual([]);
  });

  /**
   * The live guard. Every other test proves the check reacts; this one proves
   * the repository itself still satisfies it, and is what `pnpm verify` runs.
   */
  it("accepts this repository", () => {
    expect(problems(checkInstructionSurfaces(repositoryRoot))).toBe("");
  });

  it.each(vendorPointers)(
    "reports a hand-edited $path and names the command that regenerates it",
    (pointer) => {
      const root = cleanCheckout();
      write(
        root,
        pointer.path,
        `${renderPointer(pointer)}\nAlso, never use \`any\`.\n`,
      );

      const violations = checkInstructionSurfaces(root);

      expect(violations).toHaveLength(1);
      expect(violations[0]?.file).toBe(pointer.path);
      expect(violations[0]?.problem).toContain("stale");
      expect(violations[0]?.fix).toContain("pnpm instructions:write");
    },
  );

  it.each(vendorPointers)("reports a missing $path", (pointer) => {
    const root = cleanCheckout();
    rmSync(path.join(root, pointer.path));

    const violations = checkInstructionSurfaces(root);

    expect(problems(violations)).toContain(pointer.vendor);
    expect(violations[0]?.fix).toContain("pnpm instructions:write");
  });

  it("reports a rule copied from the root contract into scoped instructions", () => {
    const root = cleanCheckout();
    write(
      root,
      scopedPath,
      `${scopedContract}\n- Validate every untrusted runtime boundary with Zod, because TypeScript types alone are not validation.\n`,
    );

    const violations = checkInstructionSurfaces(root);

    expect(violations).toHaveLength(1);
    expect(violations[0]?.file).toBe(scopedPath);
    expect(violations[0]?.problem).toContain("already stated in AGENTS.md");
  });

  it("reports a rule that survives rewrapping and repunctuation", () => {
    const root = cleanCheckout();
    write(
      root,
      scopedPath,
      `${scopedContract}\n- **Validate** every untrusted runtime boundary with \`Zod\` — because TypeScript types alone are not validation!\n`,
    );

    expect(checkInstructionSurfaces(root)[0]?.problem).toContain(
      "already stated in AGENTS.md",
    );
  });

  it("reports a referenced document that does not resolve", () => {
    const root = cleanCheckout();
    write(
      root,
      "AGENTS.md",
      `${contract}\nSee [the guide](docs/missing-guide.md).\n`,
    );

    const violations = checkInstructionSurfaces(root);

    expect(violations).toHaveLength(1);
    expect(violations[0]?.problem).toContain("docs/missing-guide.md");
  });

  it("reports a backticked path that no longer exists", () => {
    const root = cleanCheckout();
    write(
      root,
      "docs/README.md",
      "# Map\n\nSee `docs/moved-architecture.md`.\n",
    );

    expect(checkInstructionSurfaces(root)[0]?.problem).toContain(
      "docs/moved-architecture.md",
    );
  });

  /**
   * `packages/auth` and `packages/email` existed for several stages while the
   * contract's map did not mention them, and nothing failed: the reference check
   * proves the paths a document names resolve, never that it named them all. The
   * clean checkout has no workspace at all, so each case below adds one and
   * removes it from exactly one surface.
   */
  it("reports a workspace package the contract does not map", () => {
    const root = workspaceCheckout(["api", "email"]);
    const kept = [path.basename(path.dirname(scopedPath)), "api"].sort();
    write(root, "AGENTS.md", `${contract}${whereCodeBelongs(kept)}`);

    const violations = checkInstructionSurfaces(root);

    expect(problems(violations)).toBe(
      'AGENTS.md: Maps the workspace without `packages/email`, so a reader is told that package does not exist. Add `packages/email` as a "Where code belongs" bullet, saying what belongs there.',
    );
  });

  it("reports a workspace package the README tree does not map", () => {
    const root = workspaceCheckout(["api", "email"]);
    const kept = [path.basename(path.dirname(scopedPath)), "api"].sort();
    write(root, "README.md", workspaceTree(kept));

    const violations = checkInstructionSurfaces(root);

    expect(problems(violations)).toBe(
      "README.md: Maps the workspace without `packages/email`, so a reader is told that package does not exist. Add `packages/email` as a line in the workspace tree, saying what belongs there.",
    );
  });

  it("accepts a workspace both surfaces map in full", () => {
    expect(
      checkInstructionSurfaces(workspaceCheckout(["api", "email"])),
    ).toEqual([]);
  });

  it("reports scoped instructions the root contract never mentions", () => {
    const root = cleanCheckout();
    write(
      root,
      "AGENTS.md",
      "# Agent contract\n\nRead `docs/engineering-principles.md` first, always.\n",
    );

    const violations = checkInstructionSurfaces(root);

    expect(violations).toHaveLength(1);
    expect(violations[0]?.problem).toContain("undiscoverable");
  });

  it("reports the missing contract alone when the root file is gone", () => {
    const root = cleanCheckout();
    rmSync(path.join(root, "AGENTS.md"));

    const violations = checkInstructionSurfaces(root);

    expect(violations).toHaveLength(1);
    expect(violations[0]?.problem).toContain("canonical contract is missing");
  });

  it("rewrites only the pointers that drifted", () => {
    const root = cleanCheckout();
    const [pointer] = vendorPointers;
    expect(pointer).toBeDefined();
    write(root, pointer?.path ?? "", "stale\n");

    expect(writeVendorPointers(root)).toEqual([pointer?.path]);
    expect(writeVendorPointers(root)).toEqual([]);
  });
});

describe("reference extraction", () => {
  it("keeps repository references and drops external and anchor links", () => {
    expect(
      references(
        "[a](docs/architecture.md#state) [b](https://example.com) [c](#section) @./AGENTS.md `packages/db/prisma/schema.prisma`",
      ),
    ).toEqual([
      "./AGENTS.md",
      "docs/architecture.md",
      "packages/db/prisma/schema.prisma",
    ]);
  });

  it("ignores backticked tokens that are not file paths", () => {
    expect(
      references("Do not use `any`, `@ai-starter/db` or `pnpm verify`."),
    ).toEqual([]);
  });

  it("ignores references inside fenced code samples", () => {
    expect(references("```bash\npnpm run `docs/not-a-doc.md`\n```\n")).toEqual(
      [],
    );
  });
});

describe("rule statement extraction", () => {
  it("ignores headings and phrases too short to be a rule", () => {
    expect([
      ...ruleStatements("# Testing rules\n\nUse Vitest.\n").values(),
    ]).toEqual([]);
  });
});

describe("violation messages", () => {
  it("names both places a reference was looked for, without an empty directory", () => {
    const root = cleanCheckout();
    write(root, "AGENTS.md", `${contract}\nSee [it](docs/missing.md).\n`);
    write(root, "docs/README.md", "# Map\n\nSee `gone.md`.\n");

    const problems = checkInstructionSurfaces(root).map(
      (violation) => violation.problem,
    );

    expect(problems).toContain(
      "References `docs/missing.md`, which does not resolve from the repository root.",
    );
    expect(problems).toContain(
      "References `gone.md`, which does not resolve from docs/ or the repository root.",
    );
  });
});

/**
 * A template that loses its import line or its `alwaysApply` flag still
 * regenerates into a file that matches its source, so the byte comparison
 * cannot see it. These pin each entry to the vendor's actual requirement.
 */
describe("auto-load markers", () => {
  it.each(vendorPointers)(
    "$vendor renders a file that carries every load marker",
    (pointer) => {
      const rendered = renderPointer(pointer);
      const unmet = pointer.loadMarkers.filter(
        (marker) => !marker.pattern.test(rendered),
      );

      expect(unmet).toEqual([]);
      expect(pointer.loadMarkers.length).toBeGreaterThan(0);
    },
  );

  it.each(vendorPointers.filter((pointer) => pointer.reference !== undefined))(
    "$vendor loses a load marker once the import line is dropped",
    (pointer) => {
      const rendered = renderPointer({
        discovery: pointer.discovery,
        loadMarkers: pointer.loadMarkers,
        path: pointer.path,
        vendor: pointer.vendor,
        ...(pointer.frontmatter === undefined
          ? {}
          : { frontmatter: pointer.frontmatter }),
      });

      expect(
        pointer.loadMarkers.some((marker) => !marker.pattern.test(rendered)),
      ).toBe(true);
    },
  );

  it("Cursor loses a load marker once alwaysApply is turned off", () => {
    const cursor = vendorPointers.find(
      (pointer) => pointer.vendor === "Cursor",
    );
    if (cursor === undefined) {
      throw new Error("Cursor is no longer a registered vendor pointer.");
    }

    const rendered = renderPointer({
      ...cursor,
      frontmatter: [
        "description: Binding repository contract",
        "alwaysApply: false",
      ],
    });

    expect(
      cursor.loadMarkers.some((marker) => !marker.pattern.test(rendered)),
    ).toBe(true);
  });
});
