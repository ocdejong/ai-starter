import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  deadLinks,
  externalLinks,
  formatDeadLinks,
  type ExternalLink,
} from "./external-links.ts";
import { repositoryRoot } from "./repository.ts";

/**
 * The sensor's two halves, each proven without a network: which links it finds,
 * and which answers it treats as death. The second is the one that decides
 * whether it is worth reading — a sensor that files an issue every time a host
 * dislikes an unauthenticated request is a sensor everybody mutes.
 */

let root: string;

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "links-"));
  mkdirSync(path.join(root, "docs"), { recursive: true });
  writeFileSync(
    path.join(root, "README.md"),
    [
      "Run it at [the dev server](http://localhost:3000) once bootstrapped.",
      "",
      "See [the guide](https://example.com/guide) and <https://example.com/bare>.",
      "The same [guide again](https://example.com/guide) is not a second link.",
      "",
      "Internal links like [the contract](AGENTS.md) belong to `pnpm instructions`.",
    ].join("\n"),
  );
  writeFileSync(
    path.join(root, "docs/research.md"),
    "A citation: [a paper](https://example.org/paper).\n",
  );
});

afterAll(() => {
  rmSync(root, { force: true, recursive: true });
});

describe("externalLinks", () => {
  // This program reads its destinations out of files, so the set it will
  // request is a security boundary, not a convenience.
  it.each([
    "http://localhost:3000",
    "http://127.0.0.1:8080",
    "http://10.0.0.1/metadata",
    "http://192.168.1.1/admin",
    "http://169.254.169.254/latest/meta-data/",
    "http://172.16.0.5/",
    "https://registry.internal/private",
    "https://db.local/",
    "file:///etc/passwd",
    "ftp://example.com/",
  ])("refuses to request %s", (url) => {
    const root = mkdtempSync(path.join(tmpdir(), "links-private-"));
    writeFileSync(path.join(root, "README.md"), `A [link](${url}) here.\n`);

    expect(externalLinks(root)).toEqual([]);

    rmSync(root, { force: true, recursive: true });
  });

  it("finds every distinct external destination, and nothing else", () => {
    expect(externalLinks(root).map((link) => link.url)).toEqual([
      "https://example.com/guide",
      "https://example.com/bare",
      "https://example.org/paper",
    ]);
  });

  it("says which file a link is written in", () => {
    expect(
      externalLinks(root).find((link) => link.url.endsWith("/paper"))?.file,
    ).toBe("docs/research.md");
  });

  it("finds the links this repository actually carries", () => {
    const links = externalLinks(repositoryRoot);

    expect(links.length).toBeGreaterThan(0);
    expect(links.every((link) => link.url.startsWith("http"))).toBe(true);
  });
});

describe("deadLinks", () => {
  const links: ExternalLink[] = [
    { file: "README.md", url: "https://example.com/gone" },
    { file: "README.md", url: "https://example.com/moved" },
    { file: "README.md", url: "https://example.com/private" },
    { file: "README.md", url: "https://example.com/busy" },
    { file: "README.md", url: "https://example.com/broken" },
    { file: "README.md", url: "https://example.com/unreachable" },
  ];

  const answers: Readonly<Record<string, number | string>> = {
    "https://example.com/broken": 500,
    "https://example.com/busy": 429,
    "https://example.com/gone": 404,
    "https://example.com/moved": 200,
    "https://example.com/private": 403,
    "https://example.com/unreachable": "fetch failed",
  };

  it("reports what is gone and forgives what merely refused us", async () => {
    const dead = await deadLinks(links, (url) =>
      Promise.resolve(answers[url] ?? 200),
    );

    expect(dead.map((link) => link.url)).toEqual([
      "https://example.com/gone",
      "https://example.com/broken",
      "https://example.com/unreachable",
    ]);
  });

  it("names the file and the reason, so the fix needs no second look", async () => {
    const dead = await deadLinks(links.slice(0, 1), () => Promise.resolve(404));

    expect(formatDeadLinks(dead)).toBe(
      "FAIL  README.md: https://example.com/gone — HTTP 404",
    );
  });
});
