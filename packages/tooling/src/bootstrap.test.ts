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

import { updateDatabasePort } from "./bootstrap.ts";

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "bootstrap-"));
  mkdirSync(path.join(root, "apps/web"), { recursive: true });
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

describe("updateDatabasePort", () => {
  it("points DATABASE_URL at the given port and preserves the rest of the file", () => {
    const envPath = path.join(root, "apps/web/.env");
    writeFileSync(
      envPath,
      [
        "# Local development database",
        'DATABASE_URL="postgresql://postgres:password@localhost:5434/ai-starter"',
        'BETTER_AUTH_SECRET="0123456789abcdef0123456789abcdef"',
        "",
      ].join("\n"),
    );

    updateDatabasePort(root, 5436);

    const content = readFileSync(envPath, "utf8");
    expect(content).toContain(
      'DATABASE_URL="postgresql://postgres:password@localhost:5436/ai-starter"',
    );
    expect(content).toContain("# Local development database");
    expect(content).toContain(
      'BETTER_AUTH_SECRET="0123456789abcdef0123456789abcdef"',
    );
  });
});
