import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { deriveProductIdentity } from "./product-identity.ts";
import {
  starterIdentity,
  starterIdentityModulePath,
} from "./starter-identity.ts";
import { initializeStarter } from "./starter-init.ts";

const product = deriveProductIdentity(
  { applicationId: "com.acme.notes", name: "Acme Notes", scope: "acme" },
  starterIdentity,
);

let root: string;

function write(relative: string, content: string): void {
  const absolute = path.join(root, relative);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, content);
}

function read(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "starter-init-"));

  write("package.json", `{ "name": "${starterIdentity.slug}" }\n`);
  write(
    "packages/domain/package.json",
    `{ "name": "@${starterIdentity.scope}/domain" }\n`,
  );
  write(
    "apps/mobile/app.json",
    `{ "slug": "${starterIdentity.slug}", "bundleIdentifier": "${starterIdentity.applicationId}" }\n`,
  );
  write("README.md", `# ${starterIdentity.displayName}\n`);
  write(
    "apps/web/.env.example",
    `DATABASE_URL="postgresql://postgres:password@localhost:5433/${starterIdentity.slug}"\n`,
  );
  write(
    starterIdentityModulePath,
    `export const slug = "${starterIdentity.slug}";\n`,
  );
  write(
    "node_modules/vendor/index.js",
    `module.exports = "${starterIdentity.slug}";\n`,
  );
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

describe("initializeStarter", () => {
  it("replaces the identity in package names, application identifiers and visible text", () => {
    initializeStarter(root, starterIdentity, product);

    expect(read("package.json")).toContain('"name": "acme-notes"');
    expect(read("packages/domain/package.json")).toContain('"@acme/domain"');
    expect(read("apps/mobile/app.json")).toContain('"slug": "acme-notes"');
    expect(read("apps/mobile/app.json")).toContain('"com.acme.notes"');
    expect(read("README.md")).toBe("# Acme Notes\n");
    expect(read("apps/web/.env.example")).toContain(
      "localhost:5433/acme-notes",
    );
  });

  it("reports no residual identity for a fully rewritten repository", () => {
    expect(initializeStarter(root, starterIdentity, product).residual).toEqual(
      [],
    );
  });

  it("never touches installed dependencies", () => {
    initializeStarter(root, starterIdentity, product);

    expect(read("node_modules/vendor/index.js")).toContain(
      starterIdentity.slug,
    );
  });

  it("keeps the starter identity module as the canonical record", () => {
    const result = initializeStarter(root, starterIdentity, product);

    expect(read(starterIdentityModulePath)).toContain(starterIdentity.slug);
    expect(result.changedFiles).not.toContain(starterIdentityModulePath);
  });

  it("fails when a file name still carries the starter identity", () => {
    write(`apps/web/public/${starterIdentity.slug}-logo.png`, "not text");

    const result = initializeStarter(root, starterIdentity, product);

    expect(result.residual).toEqual([
      {
        file: `apps/web/public/${starterIdentity.slug}-logo.png`,
        inPath: true,
        occurrences: [],
      },
    ]);
  });

  it("is idempotent: a second run finds nothing left to do", () => {
    initializeStarter(root, starterIdentity, product);
    const second = initializeStarter(root, starterIdentity, product);

    expect(second.matchedFiles).toBe(0);
    expect(second.changedFiles).toEqual([]);
    expect(second.residual).toEqual([]);
  });
});
