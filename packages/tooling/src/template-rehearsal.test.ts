import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runCapture } from "./command.ts";
import { featureMigrationSql } from "./generators/feature.ts";
import { featureNames } from "./generators/naming.ts";
import { starterIdentity } from "./starter-identity.ts";
import {
  finishFeatureMigration,
  instantiateTemplate,
  moveWebOrigin,
  rehearsalProductName,
  rehearsalSlices,
} from "./template-rehearsal.ts";

/**
 * The rehearsal itself takes an install, a database and a full suite, so it is
 * a scheduled sensor rather than a test. What is tested here is every decision
 * it makes on the way: what a template instantiation contains, the SQL the
 * migration follow-up leaves behind, and the port the browser journey runs on.
 * Each of those is a place where a wrong answer would make the sensor pass
 * while rehearsing something other than the golden path.
 */

let workspace: string;

beforeAll(() => {
  workspace = mkdtempSync(path.join(tmpdir(), "rehearsal-unit-"));
});

afterAll(() => {
  rmSync(workspace, { force: true, recursive: true });
});

describe("instantiateTemplate", () => {
  /**
   * A source checkout of its own rather than this repository's. The rehearsal
   * runs inside the product it just created, where `pnpm verify` runs these
   * tests again — and that checkout has no history at all, which is the whole
   * point of it. A test reaching for the ambient repository passes here and
   * fails there, for a reason that says nothing about the code.
   */
  function source(): string {
    const root = path.join(workspace, "source");
    mkdirSync(path.join(root, "packages/tooling"), { recursive: true });
    writeFileSync(path.join(root, "AGENTS.md"), "# Contract\n");
    writeFileSync(path.join(root, "package.json"), '{ "name": "starter" }\n');
    writeFileSync(path.join(root, ".gitignore"), "node_modules/\n.env\n");
    writeFileSync(
      path.join(root, "packages/tooling/template.ts.template"),
      "export const {{camel}} = 1;\n",
    );
    // Ignored, and untracked-but-ignored is exactly what must not be carried.
    mkdirSync(path.join(root, "node_modules"), { recursive: true });
    writeFileSync(path.join(root, "node_modules/installed.js"), "");
    writeFileSync(path.join(root, ".env"), "SECRET=local\n");

    for (const args of [
      ["init", "--quiet"],
      ["add", "--all"],
      [
        "-c",
        "user.email=t@example.com",
        "-c",
        "user.name=T",
        "commit",
        "--quiet",
        "--message",
        "initial",
      ],
    ]) {
      const result = runCapture("git", args, { cwd: root });
      expect(result.code).toBe(0);
    }

    return root;
  }

  it("carries the files a template ships and leaves the rest behind", () => {
    const destination = path.join(workspace, "instantiated");

    instantiateTemplate(source(), destination);

    // What a downstream repository receives: the contract, the manifest and the
    // templates the generators render.
    expect(existsSync(path.join(destination, "AGENTS.md"))).toBe(true);
    expect(existsSync(path.join(destination, "package.json"))).toBe(true);
    expect(
      existsSync(
        path.join(destination, "packages/tooling/template.ts.template"),
      ),
    ).toBe(true);

    // And what it does not: no history, no install, no local environment. A
    // rehearsal that inherited any of the three would not be rehearsing a fresh
    // checkout at all.
    expect(existsSync(path.join(destination, ".git"))).toBe(false);
    expect(existsSync(path.join(destination, "node_modules"))).toBe(false);
    expect(existsSync(path.join(destination, ".env"))).toBe(false);
  });

  // A downstream product inherits this command, and a product that has not run
  // `git init` yet would otherwise meet git's bare exit code 128.
  it("says so when there is no checkout to read", () => {
    expect(() =>
      instantiateTemplate(workspace, path.join(workspace, "nowhere")),
    ).toThrow(/not a git checkout/);
  });
});

describe("finishFeatureMigration", () => {
  const migration =
    "packages/db/prisma/migrations/29990101000000_add_release_notes/migration.sql";
  const prismaWrote = '-- CreateTable\nCREATE TABLE "ReleaseNote" ();\n';

  it("puts the timeouts above what Prisma wrote and the rest below it", () => {
    const checkout = path.join(workspace, "finish");
    mkdirSync(path.join(checkout, path.dirname(migration)), {
      recursive: true,
    });
    writeFileSync(path.join(checkout, migration), prismaWrote);

    const reported = finishFeatureMigration(checkout, rehearsalSlices.feature);
    const sql = readFileSync(path.join(checkout, migration), "utf8");
    const expected = featureMigrationSql(featureNames(rehearsalSlices.feature));

    expect(reported).toBe(migration);
    expect(sql.indexOf("set lock_timeout")).toBeLessThan(
      sql.indexOf("CREATE TABLE"),
    );
    expect(sql.indexOf("CREATE TABLE")).toBeLessThan(
      sql.indexOf("CREATE UNIQUE INDEX"),
    );
    // The instruction a reader is given and the text the sensor applies are the
    // same string, so a follow-up that stops being runnable fails the sensor.
    expect(sql).toBe(`${expected.header}${prismaWrote}${expected.body}`);
  });

  it("says so rather than guessing when Prisma wrote nothing", () => {
    const checkout = path.join(workspace, "empty");
    mkdirSync(path.join(checkout, "packages/db/prisma/migrations"), {
      recursive: true,
    });

    expect(() =>
      finishFeatureMigration(checkout, rehearsalSlices.feature),
    ).toThrow(/no migration/);
  });
});

describe("moveWebOrigin", () => {
  it("moves the journey off the port a developer is already using", async () => {
    const checkout = path.join(workspace, "origin");
    mkdirSync(path.join(checkout, "apps/web"), { recursive: true });
    writeFileSync(
      path.join(checkout, "apps/web/.env"),
      'BETTER_AUTH_URL="http://localhost:3000"\n',
    );

    const port = await moveWebOrigin(checkout);
    const written = readFileSync(path.join(checkout, "apps/web/.env"), "utf8");

    expect(port).toBeGreaterThan(3000);
    expect(written).toContain(`http://localhost:${String(port)}`);
    expect(written).not.toContain("localhost:3000");
  });
});

describe("the product a rehearsal becomes", () => {
  /**
   * `starter:init` derives every identifier from the name, and a single-word
   * name collapses the forms it derives — so a rehearsal named "Product" would
   * pass while leaving a two-word product broken.
   */
  it("has a name whose identifier forms differ from each other", () => {
    expect(rehearsalProductName.split(" ").length).toBeGreaterThan(1);

    for (const slice of Object.values(rehearsalSlices)) {
      expect(slice).toContain("-");
    }
  });

  // Compared against the recorded starter identity, not against whatever this
  // checkout is called: inside a rehearsed product the package *is* the
  // rehearsal product, and `starter-identity.ts` is the one module
  // `starter:init` deliberately leaves alone.
  it("is a name the starter does not already answer to", () => {
    expect(rehearsalProductName.toLowerCase().replace(" ", "-")).not.toBe(
      starterIdentity.slug,
    );
  });
});
