import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  checkRepositoryPolicy,
  type PolicyViolation,
} from "./repository-policy.ts";
import { repositoryRoot } from "./repository.ts";
import { verificationSteps } from "./verification.ts";

/**
 * The static structural guard. Every test starts from a checkout that satisfies
 * the whole policy, then breaks exactly one thing and asserts the check reports it
 * with the file named and the fix stated — the shape `instruction-policy.test.ts`
 * established. One test proves the live repository still passes.
 */

const strictBase = JSON.stringify({
  compilerOptions: {
    exactOptionalPropertyTypes: true,
    noUncheckedIndexedAccess: true,
    strict: true,
  },
});

const extendsBase = JSON.stringify({
  extends: "@ai-starter/config/typescript/base.json",
});

const rootScripts = Object.fromEntries(
  verificationSteps.map((step) => [step.name, `run ${step.name}`]),
);

function manifest(fields: Record<string, unknown>): string {
  return JSON.stringify(fields);
}

/** A minimal workspace that passes every check, so a test can break one thing. */
function baseFiles(): Record<string, string> {
  return {
    ".gitignore": "node_modules/\n/packages/db/generated/\n",
    "package.json": manifest({ name: "ai-starter", scripts: rootScripts }),
    "pnpm-workspace.yaml": 'packages:\n  - "apps/*"\n  - "packages/*"\n',

    "packages/config/package.json": manifest({
      name: "@ai-starter/config",
      scripts: { lint: "eslint .", typecheck: "tsc --noEmit" },
    }),
    "packages/config/typescript/base.json": strictBase,

    "packages/domain/package.json": manifest({
      devDependencies: { "@ai-starter/config": "workspace:*" },
      exports: { ".": "./src/index.ts" },
      name: "@ai-starter/domain",
      scripts: { lint: "eslint .", typecheck: "tsc --noEmit" },
    }),
    "packages/domain/tsconfig.json": extendsBase,
    "packages/domain/src/index.ts": "export const value = 1;\n",

    "packages/db/package.json": manifest({
      dependencies: { "@prisma/client": "^6" },
      exports: { ".": "./src/index.ts" },
      name: "@ai-starter/db",
      scripts: { lint: "eslint .", typecheck: "tsc --noEmit" },
    }),
    "packages/db/tsconfig.json": extendsBase,
    "packages/db/src/index.ts": "export const client = {};\n",

    "packages/api/package.json": manifest({
      dependencies: { "@ai-starter/domain": "workspace:*" },
      exports: { ".": "./src/index.ts", "./client": "./src/client.ts" },
      name: "@ai-starter/api",
      scripts: { lint: "eslint .", typecheck: "tsc --noEmit" },
    }),
    "packages/api/tsconfig.json": extendsBase,
    "packages/api/src/index.ts": "export const router = {};\n",
  };
}

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

/** Writes the base checkout, letting `overrides` replace or add individual files. */
function checkout(overrides: Record<string, string> = {}): string {
  const root = mkdtempSync(path.join(tmpdir(), "repo-policy-"));
  temporaryRoots.push(root);

  for (const [file, content] of Object.entries({
    ...baseFiles(),
    ...overrides,
  })) {
    const absolute = path.join(root, file);
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, content, "utf8");
  }

  return root;
}

function report(violations: readonly PolicyViolation[]): string {
  return violations
    .map(
      (violation) => `${violation.file}: ${violation.problem} ${violation.fix}`,
    )
    .join("\n");
}

describe("repository policy", () => {
  it("accepts a checkout that satisfies every check", () => {
    expect(checkRepositoryPolicy(checkout())).toEqual([]);
  });

  it("accepts this repository", () => {
    expect(report(checkRepositoryPolicy(repositoryRoot))).toBe("");
  });

  it("reports a workspace dependency outside the package's allowed layer", () => {
    const root = checkout({
      "packages/domain/package.json": manifest({
        dependencies: { "@ai-starter/db": "workspace:*" },
        exports: { ".": "./src/index.ts" },
        name: "@ai-starter/domain",
        scripts: { lint: "eslint .", typecheck: "tsc --noEmit" },
      }),
    });

    const violations = checkRepositoryPolicy(root);

    expect(violations).toHaveLength(1);
    expect(violations[0]?.file).toBe("packages/domain/package.json");
    expect(violations[0]?.problem).toContain("@ai-starter/db");
  });

  it("reports a wildcard export that exposes internals", () => {
    const root = checkout({
      "packages/domain/package.json": manifest({
        exports: { "./*": "./src/*" },
        name: "@ai-starter/domain",
        scripts: { lint: "eslint .", typecheck: "tsc --noEmit" },
      }),
    });

    expect(checkRepositoryPolicy(root)[0]?.problem).toContain("wildcard");
  });

  it("reports a library package with no exports map", () => {
    const root = checkout({
      "packages/domain/package.json": manifest({
        name: "@ai-starter/domain",
        scripts: { lint: "eslint .", typecheck: "tsc --noEmit" },
      }),
    });

    expect(checkRepositoryPolicy(root)[0]?.problem).toContain("no exports map");
  });

  it("reports a tsconfig that disables a strict flag", () => {
    const root = checkout({
      "packages/domain/tsconfig.json": JSON.stringify({
        compilerOptions: { strict: false },
        extends: "@ai-starter/config/typescript/base.json",
      }),
    });

    const violations = checkRepositoryPolicy(root);

    expect(violations).toHaveLength(1);
    expect(violations[0]?.file).toBe("packages/domain/tsconfig.json");
    expect(violations[0]?.problem).toContain("strict");
  });

  it("reports a tsconfig that does not extend the strict base", () => {
    const root = checkout({
      "packages/domain/tsconfig.json": JSON.stringify({
        extends: "expo/tsconfig.base",
      }),
    });

    expect(checkRepositoryPolicy(root)[0]?.problem).toContain(
      "does not extend the shared strict base",
    );
  });

  it("reports a vendor SDK held by the wrong package", () => {
    const root = checkout({
      "packages/api/package.json": manifest({
        dependencies: {
          "@ai-starter/domain": "workspace:*",
          "@prisma/client": "^6",
        },
        exports: { ".": "./src/index.ts", "./client": "./src/client.ts" },
        name: "@ai-starter/api",
        scripts: { lint: "eslint .", typecheck: "tsc --noEmit" },
      }),
    });

    const violations = checkRepositoryPolicy(root);

    expect(violations).toHaveLength(1);
    expect(violations[0]?.file).toBe("packages/api/package.json");
    expect(violations[0]?.problem).toContain("@prisma/client");
  });

  it("reports a @ts-ignore that silences the type checker", () => {
    const root = checkout({
      "packages/domain/src/index.ts":
        "// @ts-ignore\nexport const value = 1;\n",
    });

    const violations = checkRepositoryPolicy(root);

    expect(violations).toHaveLength(1);
    expect(violations[0]?.file).toBe("packages/domain/src/index.ts:1");
    expect(violations[0]?.problem).toContain("@ts-ignore");
  });

  it("reports an eslint-disable without a justification", () => {
    const root = checkout({
      "packages/domain/src/index.ts":
        "// eslint-disable-next-line no-console\nexport const value = 1;\n",
    });

    expect(checkRepositoryPolicy(root)[0]?.problem).toContain(
      "without a justification",
    );
  });

  it("accepts a @ts-expect-error and eslint-disable that carry a reason", () => {
    const root = checkout({
      "packages/domain/src/index.ts":
        "// @ts-expect-error the upstream type is wrong\n" +
        "// eslint-disable-next-line no-console -- the CLI prints here\n" +
        "export const value = 1;\n",
    });

    expect(checkRepositoryPolicy(root)).toEqual([]);
  });

  it("reports a @ts-expect-error with no explanation", () => {
    const root = checkout({
      "packages/domain/src/index.ts":
        "// @ts-expect-error\nexport const value = 1;\n",
    });

    expect(checkRepositoryPolicy(root)[0]?.problem).toContain("no explanation");
  });

  it("reports the generated Prisma client not being gitignored", () => {
    const root = checkout({ ".gitignore": "node_modules/\n" });

    const violations = checkRepositoryPolicy(root);

    expect(violations).toHaveLength(1);
    expect(violations[0]?.file).toBe(".gitignore");
  });

  it("reports a package missing a required script", () => {
    const root = checkout({
      "packages/domain/package.json": manifest({
        exports: { ".": "./src/index.ts" },
        name: "@ai-starter/domain",
        scripts: { lint: "eslint ." },
      }),
    });

    expect(checkRepositoryPolicy(root)[0]?.problem).toContain("typecheck");
  });

  it("reports error reporting that can send personal data", () => {
    const root = checkout({
      "apps/web/instrumentation.ts":
        "Sentry.init({ dsn, enabled: Boolean(dsn), tracesSampleRate: 1 });\n",
    });

    const violations = checkRepositoryPolicy(root);

    expect(violations).toHaveLength(1);
    expect(violations[0]?.file).toBe("apps/web/instrumentation.ts");
    expect(violations[0]?.problem).toContain("sendDefaultPii");
  });

  it("reports error reporting that initializes without a DSN gate", () => {
    const root = checkout({
      "apps/mobile/src/app/_layout.tsx":
        "Sentry.init({ dsn, enabled: true, sendDefaultPii: false });\n",
    });

    const violations = checkRepositoryPolicy(root);

    expect(violations).toHaveLength(1);
    expect(violations[0]?.problem).toContain("does not depend on the DSN");
  });

  it("accepts error reporting gated on its DSN and sending no personal data", () => {
    const root = checkout({
      "apps/web/instrumentation.ts": [
        "Sentry.init({",
        "  dsn,",
        "  enabled: Boolean(dsn) && process.env.NODE_ENV !== 'test',",
        "  sendDefaultPii: false,",
        "  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1,",
        "});",
      ].join("\n"),
    });

    expect(checkRepositoryPolicy(root)).toEqual([]);
  });

  it("reports an app environment variable outside the build task's hash", () => {
    const root = checkout({
      "apps/web/src/env.js":
        "export const env = { secret: process.env.BETTER_AUTH_SECRET };\n",
      "turbo.json": JSON.stringify({
        tasks: { build: { env: ["DATABASE_URL"] } },
      }),
    });

    const violations = checkRepositoryPolicy(root);

    expect(violations).toHaveLength(1);
    expect(violations[0]?.file).toBe("turbo.json");
    expect(violations[0]?.problem).toContain("BETTER_AUTH_SECRET");
  });

  it("accepts an app environment variable a prefix pattern covers", () => {
    const root = checkout({
      "apps/mobile/src/env.ts":
        "export const env = { url: process.env.EXPO_PUBLIC_API_URL };\n",
      "turbo.json": JSON.stringify({
        tasks: { build: { env: ["EXPO_PUBLIC_*"] } },
      }),
    });

    expect(checkRepositoryPolicy(root)).toEqual([]);
  });

  it("reports the root missing a verification-step script", () => {
    const step = verificationSteps[0]?.name ?? "";
    const remaining = { ...rootScripts };
    delete remaining[step];
    const root = checkout({
      "package.json": manifest({ name: "ai-starter", scripts: remaining }),
    });

    const violations = checkRepositoryPolicy(root);

    expect(violations).toHaveLength(1);
    expect(violations[0]?.file).toBe("package.json");
    expect(violations[0]?.problem).toContain(step);
  });
});
