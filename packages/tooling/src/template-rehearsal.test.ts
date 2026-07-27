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
import { repositoryRoot } from "./repository.ts";
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
  it("carries the files a template ships and leaves the rest behind", () => {
    const destination = path.join(workspace, "instantiated");

    expect(instantiateTemplate(repositoryRoot, destination)).toBe(0);

    // What a downstream repository receives: the contract, the manifest and the
    // templates the generators render.
    expect(existsSync(path.join(destination, "AGENTS.md"))).toBe(true);
    expect(existsSync(path.join(destination, "package.json"))).toBe(true);
    expect(
      existsSync(
        path.join(
          destination,
          "packages/tooling/templates/adapter/apps/web/src/server/{{kebab}}/client.ts.template",
        ),
      ),
    ).toBe(true);

    // And what it does not: no history, no install, no local environment. A
    // rehearsal that inherited any of the three would not be rehearsing a fresh
    // checkout at all.
    expect(existsSync(path.join(destination, ".git"))).toBe(false);
    expect(existsSync(path.join(destination, "node_modules"))).toBe(false);
    expect(existsSync(path.join(destination, "apps/web/.env"))).toBe(false);
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

  it("is a name this repository does not already answer to", () => {
    const initialised = runCapture(
      "node",
      [
        "-e",
        'process.stdout.write(JSON.stringify(require("./package.json").name))',
      ],
      { cwd: repositoryRoot },
    );

    expect(initialised.stdout).not.toContain(
      rehearsalProductName.toLowerCase().replace(" ", "-"),
    );
  });
});
